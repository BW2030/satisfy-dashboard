const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'content.json');

app.use(express.json({ limit: '100kb' }));

// ── Security Headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Inline styles needed for the dashboard; scripts only from same origin
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://satis-fy.com; connect-src 'self'");
  next();
});

// ── Session Store ─────────────────────────────────────────────────────────────
const sessions = new Map(); // token → { name, expiresAt }
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function createSession(name) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { name, expiresAt: Date.now() + SESSION_DURATION_MS });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
  return session;
}

// Clean expired sessions every hour
setInterval(() => {
  for (const [token, session] of sessions) {
    if (Date.now() > session.expiresAt) sessions.delete(token);
  }
}, 60 * 60 * 1000);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const loginAttempts = new Map(); // ip+name → { count, lockedUntil }
const FAIL_LIMIT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkRateLimit(ip, name) {
  const key = `${ip}:${name.toLowerCase()}`;
  const now = Date.now();
  const state = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  if (state.lockedUntil > now) return { blocked: true, retryAfter: Math.ceil((state.lockedUntil - now) / 1000) };
  return { blocked: false, state, key };
}

function recordFailedAttempt(key) {
  const state = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  state.count++;
  if (state.count >= FAIL_LIMIT) {
    state.lockedUntil = Date.now() + LOCKOUT_MS;
    state.count = 0;
  }
  loginAttempts.set(key, state);
}

// ── PIN Hashing ───────────────────────────────────────────────────────────────

async function hashPin(pin) {
  const { subtle } = crypto.webcrypto;
  const salt = crypto.randomBytes(16).toString('hex');
  const enc = new TextEncoder();
  const key = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

async function verifyPin(pin, stored) {
  const { subtle } = crypto.webcrypto;
  const enc = new TextEncoder();
  if (stored.includes(':')) {
    const [salt, hash] = stored.split(':');
    const key = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      key, 256
    );
    const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    // Constant-time comparison to prevent timing attacks
    return computed.length === hash.length && crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }
  // Legacy SHA-256 fallback
  const hashBuffer = await subtle.digest('SHA-256', enc.encode(pin));
  const legacy = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return legacy === stored;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Auth Middleware ────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Nicht autorisiert. Bitte einloggen.' });
  req.session = session;
  next();
}

// ── Content Validation ────────────────────────────────────────────────────────

function validateContent(req, res, next) {
  const { users, kpis, messages, calendar } = req.body;
  if (!Array.isArray(users) || !Array.isArray(kpis) || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Ungültige Datenstruktur.' });
  }
  if (kpis.length > 6 || messages.length > 50) {
    return res.status(400).json({ error: 'Zu viele Einträge.' });
  }
  next();
}

// ── Server-Sent Events (live update push to display) ─────────────────────────
const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering on Render
  res.flushHeaders();
  res.write('data: connected\n\n');
  sseClients.add(res);
  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

function pushUpdate() {
  for (const client of sseClients) {
    client.write('data: update\n\n');
  }
}

// ── Keep-Alive Ping (prevents Render free tier from sleeping) ────────────────
app.get('/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Static Files ──────────────────────────────────────────────────────────────
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use('/display', express.static(path.join(__dirname, 'display')));
app.use('/admin',   express.static(path.join(__dirname, 'admin')));

// Root → display
app.get('/', (req, res) => res.redirect('/display/'));

// ── API: Login ─────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const { name, pin } = req.body || {};

  if (!name || !pin || typeof name !== 'string' || typeof pin !== 'string') {
    return res.status(400).json({ error: 'Name und PIN erforderlich.' });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: 'Ungültiger PIN.' });
  }

  const rl = checkRateLimit(ip, name);
  if (rl.blocked) {
    return res.status(429).json({ error: `Zu viele Versuche. Bitte ${rl.retryAfter}s warten.` });
  }

  try {
    const data = readData();
    const user = data.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (user && user.pin && await verifyPin(pin, user.pin)) {
      const token = createSession(user.name);
      return res.json({ token });
    }
    recordFailedAttempt(rl.key);
    return res.status(401).json({ error: 'Name oder PIN falsch.' });
  } catch (e) {
    console.error('Login error:', e.message);
    return res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── API: Check server presence (no auth needed, just 200) ────────────────────
app.head('/api/content', (req, res) => res.sendStatus(200));

// ── API: Get content (public – display page reads this without login) ────────
app.get('/api/content', (req, res) => {
  try {
    const data = readData();
    // Strip PIN hashes and Teams client secret before sending to client
    const teams = data.teams ? { ...data.teams, clientSecret: undefined } : undefined;
    const safe = { ...data, users: data.users.map(u => ({ name: u.name })), teams };
    res.json(safe);
  } catch {
    res.status(500).json({ error: 'Fehler beim Lesen der Daten.' });
  }
});

// ── API: Save content (auth required) ────────────────────────────────────────
app.post('/api/content', requireAuth, validateContent, (req, res) => {
  try {
    const existing = readData();
    // Merge teams config – preserve existing clientSecret if not re-entered
    const teamsNew = req.body.teams || {};
    const teamsExisting = existing.teams || {};
    const teams = { ...teamsExisting, ...teamsNew,
      clientSecret: teamsNew.clientSecret || teamsExisting.clientSecret };
    // Preserve PIN hashes – never overwrite from client
    const saved = { ...req.body, users: existing.users, calendar: existing.calendar || [], teams };
    writeData(saved);
    pushUpdate();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern der Daten.' });
  }
});

// ── Teams Calendar (Microsoft Graph API) ─────────────────────────────────────
let _graphToken = null;
let _graphTokenExpiry = 0;
let _calendarCache = null;
let _calendarCacheTime = 0;

async function getGraphToken(tenantId, clientId, clientSecret) {
  if (_graphToken && Date.now() < _graphTokenExpiry) return _graphToken;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) { const t = await res.text(); throw new Error('Token error: ' + t); }
  const data = await res.json();
  _graphToken = data.access_token;
  _graphTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _graphToken;
}

app.get('/api/calendar', async (req, res) => {
  try {
    const data = readData();
    const teams = data.teams || {};
    if (!teams.enabled || !teams.tenantId || !teams.clientId || !teams.clientSecret || !teams.userEmail) {
      return res.json([]);
    }
    // Return cached result if fresh (5 min)
    if (_calendarCache && Date.now() - _calendarCacheTime < 5 * 60 * 1000) {
      return res.json(_calendarCache);
    }
    const token = await getGraphToken(teams.tenantId, teams.clientId, teams.clientSecret);
    const now = new Date();
    const start = now.toISOString();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const evRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(teams.userEmail)}/calendarView` +
      `?startDateTime=${start}&endDateTime=${end}` +
      `&$select=subject,start,end,organizer,isAllDay&$orderby=start/dateTime&$top=10`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!evRes.ok) { const t = await evRes.text(); throw new Error('Graph error: ' + t); }
    const evData = await evRes.json();
    const events = (evData.value || []).map(e => ({
      subject: e.subject || '(Kein Titel)',
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      organizer: e.organizer?.emailAddress?.name || '',
      isAllDay: !!e.isAllDay
    }));
    _calendarCache = events;
    _calendarCacheTime = Date.now();
    res.json(events);
  } catch (e) {
    console.error('Calendar error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── API: Change PIN (auth required) ──────────────────────────────────────────
app.post('/api/change-pin', requireAuth, async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const { name, currentPin, newPin } = req.body || {};

  if (!name || !currentPin || !newPin) return res.status(400).json({ error: 'Fehlende Felder.' });
  if (!/^\d{4,8}$/.test(newPin)) return res.status(400).json({ error: 'PIN muss 4–8 Ziffern haben.' });
  if (req.session.name.toLowerCase() !== name.toLowerCase()) {
    return res.status(403).json({ error: 'Nicht erlaubt.' });
  }

  const rl = checkRateLimit(ip, name);
  if (rl.blocked) return res.status(429).json({ error: 'Zu viele Versuche.' });

  try {
    const data = readData();
    const user = data.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user || !(await verifyPin(currentPin, user.pin))) {
      recordFailedAttempt(rl.key);
      return res.status(401).json({ error: 'Aktueller PIN falsch.' });
    }
    user.pin = await hashPin(newPin);
    writeData(data);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── Initialize default user if missing ───────────────────────────────────────
async function ensureDefaultUser() {
  try {
    const data = readData();
    if (!data.users || !data.users[0]?.pin) {
      data.users = [{ name: 'admin', pin: await hashPin('1234') }];
      writeData(data);
      console.log('\n  ⚠  Standard-Login angelegt: admin / 1234  ⚠');
      console.log('  Bitte PIN nach dem ersten Login ändern!\n');
    }
  } catch (e) {
    console.error('Fehler beim Initialisieren der Daten:', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  await ensureDefaultUser();
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) { localIP = net.address; }
    }
  }
  const isRender = !!process.env.RENDER;
  console.log('\n📺 FireTV Dashboard Server gestartet');
  console.log('─────────────────────────────────────');
  if (isRender) {
    console.log('  Modus:    ☁️  Render.com (Online)');
    console.log('  Display:  https://<dein-name>.onrender.com/display/');
    console.log('  Admin:    https://<dein-name>.onrender.com/admin/login.html');
  } else {
    console.log(`  Display:  http://${localIP}:${PORT}/display/`);
    console.log(`  Admin:    http://${localIP}:${PORT}/admin/login.html`);
  }
  console.log('─────────────────────────────────────\n');
});
