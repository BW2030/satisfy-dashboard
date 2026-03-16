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
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Inline styles needed for the dashboard; scripts only from same origin
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://satis-fy.com; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; frame-src *;");
  next();
});

// ── Session Store ─────────────────────────────────────────────────────────────
const sessions = new Map(); // token → { name, expiresAt }
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function createSession(name) {
  // Alle bestehenden Sessions dieses Users ungültig machen – nur 1 gleichzeitig erlaubt
  for (const [token, session] of sessions) {
    if (session.name.toLowerCase() === name.toLowerCase()) sessions.delete(token);
  }
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
const _loginAttempts = new Map(); // "ip:name" → { count, resetAt }
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS   = 15 * 60 * 1000; // 15 Minuten

// Cleanup abgelaufener Einträge stündlich
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _loginAttempts) if (now > v.resetAt) _loginAttempts.delete(k);
}, 60 * 60 * 1000);

function checkRateLimit(ip, name) {
  const key = (ip || 'unknown') + ':' + (name || '').toLowerCase();
  const now  = Date.now();
  let rec = _loginAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + LOGIN_LOCKOUT_MS };
    _loginAttempts.set(key, rec);
  }
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    return { blocked: true, key, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { blocked: false, key };
}

function recordFailedAttempt(key) {
  const rec = _loginAttempts.get(key);
  if (rec) rec.count++;
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

const DEFAULT_DATA = {
  users: [],
  widgets: {
    clock: true, infoboard: true, showPing: false, animals: false, calendar: true,
    lassoBoard: false, rotate90: false,
    weather: { enabled: false, city: 'New York', lat: 40.7128, lon: -74.006 },
    embedUrl: '',
    embedSlots: [
      { id: 2, label: 'Embed 2', url: '', active: false },
      { id: 3, label: 'Embed 3', url: '', active: false },
      { id: 4, label: 'Embed 4', url: '', active: false },
      { id: 5, label: 'Embed 5', url: '', active: false }
    ]
  },
  kpis: [1,2,3,4,5,6].map(id => ({ id, label: '', value: '', unit: '', active: false })),
  messages: [{ id: 1, text: 'Willkommen! Inhalte im Admin-Bereich anpassen.', priority: 'normal', active: true }],
  lassoMessages: [],
  calendar: {},
  pages: { active: 'display', rotationSec: 30 },
  teams: { enabled: false, tenantId: '', clientId: '', userEmail: '' },
  slides: [
    { id: 1, name: 'Termine',   type: 'calendar',  url: '', content: '', active: false },
    { id: 2, name: 'Dashboard', type: 'dashboard', url: '', content: '', active: false },
    { id: 3, name: 'Slide 3',   type: 'text',      url: '', content: '', active: false },
    { id: 4, name: 'Slide 4',   type: 'embed',     url: '', content: '', active: false },
    { id: 5, name: 'Slide 5',   type: 'text',      url: '', content: '', active: false }
  ]
};

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

// Atomic write: erst in .tmp schreiben, dann umbenennen.
// Verhindert korrupte Daten wenn der Prozess mid-write abstürzt.
function writeData(data) {
  const tmp = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    console.error('writeData Fehler:', e.message);
    throw e;
  }
}

// ── GitHub Mini-Datenbank ─────────────────────────────────────────────────────
const GH_TOKEN       = process.env.GITHUB_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GH_REPO  = 'BW2030/satisfy-dashboard';
const GH_FILE  = 'data/content.json';
const GH_API   = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;

async function pullFromGitHub() {
  if (!GH_TOKEN) return false;
  try {
    const res = await fetch(GH_API, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'satisfy-dashboard' }
    });
    if (!res.ok) return false;
    const file = await res.json();
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    writeData(content);
    console.log('✓ Daten von GitHub geladen');
    return true;
  } catch (e) {
    console.error('GitHub pull Fehler:', e.message);
    return false;
  }
}

// pushToGitHub mit SHA-Konflikt-Retry (max 3 Versuche) + Netzwerkfehler-Retry
async function pushToGitHub(data, _retries = 3) {
  if (!GH_TOKEN) return;
  try {
    const getRes = await fetch(GH_API, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'satisfy-dashboard' }
    });
    const sha = getRes.ok ? (await getRes.json()).sha : undefined;
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const putRes = await fetch(GH_API, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'satisfy-dashboard'
      },
      body: JSON.stringify({ message: 'auto-save: dashboard content', content, sha })
    });
    if (!putRes.ok && _retries > 0 && putRes.status === 409) {
      // SHA-Konflikt (paralleler Push) → kurz warten und nochmal versuchen
      await new Promise(r => setTimeout(r, 1500));
      return pushToGitHub(data, _retries - 1);
    }
    if (!putRes.ok) console.error('GitHub push HTTP', putRes.status);
  } catch (err) {
    if (_retries > 0) {
      const delay = (4 - _retries) * 2000; // 2s, 4s, 6s
      await new Promise(r => setTimeout(r, delay));
      return pushToGitHub(data, _retries - 1);
    }
    console.error('pushToGitHub endgültig fehlgeschlagen:', err.message);
  }
}

// scheduleContentPush: throttle + Debounce-Timer für garantierten finalen Push.
// Verhindert Datenverlust: auch wenn viele Saves in kurzer Zeit passieren,
// wird der letzte Stand sicher nach 5 Min zu GitHub gepusht.
let _lastContentGitHubPush = 0;
let _contentPushDebounceTimer = null;
function scheduleContentPush(data) {
  if (_contentPushDebounceTimer) clearTimeout(_contentPushDebounceTimer);
  if (Date.now() - _lastContentGitHubPush > 5 * 60 * 1000) {
    // Mehr als 5 Min seit letztem Push → sofort
    _lastContentGitHubPush = Date.now();
    pushToGitHub(data);
  } else {
    // Debounce: Push 5 Min nach der letzten Aktivität (neueste Daten lesen)
    _contentPushDebounceTimer = setTimeout(() => {
      _lastContentGitHubPush = Date.now();
      pushToGitHub(readData());
    }, 5 * 60 * 1000);
  }
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
const BOOT_ID = Date.now().toString(36); // unique per server start
const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering on Render
  res.flushHeaders();
  res.write('data: connected:' + BOOT_ID + '\n\n');
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
let lastExternalPing = null;
let _lastPingGitHubPush = 0; // Throttle für Ping: max 1 Push pro 10 Min

app.get('/ping', (req, res) => {
  lastExternalPing = new Date().toISOString();
  // Zeitstempel lokal speichern
  try {
    const data = readData();
    if (!data.meta) data.meta = {};
    data.meta.lastPingAt = lastExternalPing;
    writeData(data);
    // GitHub-Push max alle 5 Minuten (damit Timestamp Restarts überlebt)
    if (Date.now() - _lastPingGitHubPush > 5 * 60 * 1000) {
      _lastPingGitHubPush = Date.now();
      pushToGitHub(data);
    }
  } catch {}
  res.json({ ok: true, time: lastExternalPing });
});

app.get('/api/last-ping', (req, res) => {
  // Aus Speicher oder Fallback aus Datei
  const time = lastExternalPing || (() => {
    try { return readData().meta?.lastPingAt || null; } catch { return null; }
  })();
  res.json({ time });
});

// ── Kurze TV-URLs /tv/1 bis /tv/5 ────────────────────────────────────────
for (let i = 1; i <= 5; i++) {
  app.get('/tv/' + i, (req, res) => res.redirect('/display/slide.html?id=' + i));
}

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
    // Mask Smartsheet accessToken
    const ss = data.smartsheet;
    const smartsheet = ss ? { ...ss, accessToken: ss.accessToken ? '****' : '' } : undefined;
    const safe = { ...data, users: data.users.map(u => ({ name: u.name })), teams, smartsheet };
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
    // Merge smartsheet config – preserve existing accessToken if "****" sent
    const ssNew = req.body.smartsheet || {};
    const ssExisting = existing.smartsheet || {};
    const smartsheet = { ...ssExisting, ...ssNew,
      accessToken: (ssNew.accessToken && ssNew.accessToken !== '****') ? ssNew.accessToken : ssExisting.accessToken };
    // Preserve PIN hashes – never overwrite from client
    // calendar.icsUrl aus Body übernehmen, aber alte Struktur beibehalten
    const calendarNew = req.body.calendar || {};
    const saved = { ...req.body, users: existing.users, calendar: calendarNew, teams, smartsheet };
    writeData(saved);
    scheduleContentPush(saved);
    pushUpdate();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern der Daten.' });
  }
});

// ── ICS Kalender-Abo ──────────────────────────────────────────────────────────
let _icsCache = null;
let _icsCacheTime = 0;

function parseICS(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  blocks.shift(); // alles vor dem ersten VEVENT entfernen
  for (const block of blocks) {
    const get = (key) => {
      const re = new RegExp(`${key}[^:]*:([^\r\n]+)`, 'i');
      const m = block.match(re);
      return m ? m[1].trim() : null;
    };
    const subject  = (get('SUMMARY') || '(Kein Titel)').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const org      = get('ORGANIZER;CN') || get('ORGANIZER') || '';
    const orgName  = org.replace(/mailto:.*/i, '').replace(/^:/, '').trim();

    // Datum auslesen – ganztägig (VALUE=DATE) oder mit Uhrzeit
    const dtStartRaw = get('DTSTART;VALUE=DATE') || get('DTSTART;TZID=[^:]+') || get('DTSTART');
    const dtEndRaw   = get('DTEND;VALUE=DATE')   || get('DTEND;TZID=[^:]+')   || get('DTEND');
    const isAllDay   = !!(block.match(/DTSTART;VALUE=DATE:/i));

    function parseDate(raw) {
      if (!raw) return null;
      if (raw.length === 8) return raw.slice(0,4) + '-' + raw.slice(4,6) + '-' + raw.slice(6,8);
      // YYYYMMDDTHHmmssZ oder YYYYMMDDTHHmmss
      return raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8)+'T'+
             raw.slice(9,11)+':'+raw.slice(11,13)+':'+raw.slice(13,15)+(raw.endsWith('Z')?'Z':'');
    }

    const start = parseDate(dtStartRaw);
    const end   = parseDate(dtEndRaw);
    if (!start) continue;

    // Nur zukünftige Events (ab heute)
    const startDate = new Date(start);
    const cutoff = new Date(); cutoff.setHours(0,0,0,0);
    const future  = new Date(); future.setDate(future.getDate() + 7);
    if (startDate < cutoff || startDate > future) continue;

    events.push({ subject, start, end: end || start, organizer: orgName, isAllDay });
  }
  // Nach Startdatum sortieren
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events.slice(0, 20);
}

async function fetchICS(url) {
  if (_icsCache && Date.now() - _icsCacheTime < 5 * 60 * 1000) return _icsCache;
  const res = await fetch(url, { headers: { 'User-Agent': 'satisfy-dashboard/1.0' } });
  if (!res.ok) throw new Error('ICS fetch HTTP ' + res.status);
  const text = await res.text();
  _icsCache = parseICS(text);
  _icsCacheTime = Date.now();
  return _icsCache;
}

// ── Teams Calendar – OAuth2 + Microsoft Graph ────────────────────────────────
const TOKENS_FILE = path.join(__dirname, 'data', 'tokens.json');
let _calendarCache = null;
let _calendarCacheTime = 0;
const _oauthStates = new Map();

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return {}; }
}
function writeTokens(t) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2), 'utf8');
}

async function getValidAccessToken() {
  const tokens = readTokens();
  if (!tokens.access_token) return null;
  // Still valid
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  // Try refresh
  if (!tokens.refresh_token) return null;
  const cfg = readData().teams || {};
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'https://graph.microsoft.com/Calendars.Read offline_access'
  });
  const r = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
  });
  if (!r.ok) return null;
  const t = await r.json();
  writeTokens({ ...tokens, access_token: t.access_token,
    refresh_token: t.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

// ── Admin Login via Microsoft (Identity only, kein Kalender-Scope) ───────────
const _adminOauthStates = new Map();

app.get('/auth/microsoft/admin-login', (req, res) => {
  const cfg = readData().teams || {};
  if (!cfg.tenantId || !cfg.clientId) {
    return res.redirect('/admin/login.html?ms_error=not_configured');
  }
  const state = crypto.randomBytes(16).toString('hex');
  _adminOauthStates.set(state, Date.now());
  setTimeout(() => _adminOauthStates.delete(state), 10 * 60 * 1000);
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/microsoft/admin-callback`;
  const params = new URLSearchParams({
    client_id: cfg.clientId, response_type: 'code', redirect_uri: redirectUri,
    scope: 'openid profile email User.Read', state, response_mode: 'query'
  });
  res.redirect(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${params}`);
});

app.get('/auth/microsoft/admin-callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/admin/login.html?ms_error=' + encodeURIComponent(error));
  if (!_adminOauthStates.has(state)) return res.redirect('/admin/login.html?ms_error=invalid_state');
  _adminOauthStates.delete(state);
  try {
    const cfg = readData().teams || {};
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/microsoft/admin-callback`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: cfg.clientId,
      client_secret: cfg.clientSecret, redirect_uri: redirectUri,
      scope: 'openid profile email User.Read'
    });
    const tokenRes = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokens = await tokenRes.json();
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
      headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    if (!meRes.ok) throw new Error('Graph /me failed');
    const me = await meRes.json();
    const name = me.displayName || me.mail || me.userPrincipalName || 'MS-User';
    const sessionToken = createSession(name);
    res.redirect(`/admin/login.html?_t=${sessionToken}&_n=${encodeURIComponent(name)}`);
  } catch (e) {
    console.error('Admin OAuth error:', e.message);
    res.redirect('/admin/login.html?ms_error=' + encodeURIComponent(e.message));
  }
});

// Initiate OAuth login (Kalender)
app.get('/auth/microsoft/login', (req, res) => {
  const cfg = readData().teams || {};
  if (!cfg.tenantId || !cfg.clientId) return res.redirect('/admin/index.html?teams_error=missing_config');
  const state = crypto.randomBytes(16).toString('hex');
  _oauthStates.set(state, Date.now());
  setTimeout(() => _oauthStates.delete(state), 10 * 60 * 1000);
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/microsoft/callback`;
  const params = new URLSearchParams({
    client_id: cfg.clientId, response_type: 'code', redirect_uri: redirectUri,
    scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
    state, response_mode: 'query'
  });
  res.redirect(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${params}`);
});

// OAuth callback
app.get('/auth/microsoft/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/admin/index.html?teams_error=' + encodeURIComponent(error));
  if (!_oauthStates.has(state)) return res.redirect('/admin/index.html?teams_error=invalid_state');
  _oauthStates.delete(state);
  try {
    const cfg = readData().teams || {};
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/microsoft/callback`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: cfg.clientId,
      client_secret: cfg.clientSecret, redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/Calendars.Read offline_access'
    });
    const tokenRes = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
    });
    if (!tokenRes.ok) { const t = await tokenRes.text(); throw new Error(t); }
    const tokens = await tokenRes.json();
    // Get user info
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',
      { headers: { Authorization: 'Bearer ' + tokens.access_token } });
    const me = meRes.ok ? await meRes.json() : {};
    writeTokens({
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      user_name: me.displayName || '', user_email: me.mail || me.userPrincipalName || ''
    });
    _calendarCache = null;
    res.redirect('/admin/index.html?teams_ok=1');
  } catch (e) {
    console.error('OAuth error:', e.message);
    res.redirect('/admin/index.html?teams_error=' + encodeURIComponent(e.message));
  }
});

// Teams status
app.get('/api/teams-status', requireAuth, (req, res) => {
  const t = readTokens();
  if (!t.access_token) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, expired: t.expires_at < Date.now(), userName: t.user_name, userEmail: t.user_email });
});

// Teams logout
app.post('/api/teams-logout', requireAuth, (req, res) => {
  try { fs.unlinkSync(TOKENS_FILE); } catch {}
  _calendarCache = null;
  res.json({ ok: true });
});

// Calendar endpoint – ICS Abo oder Teams
app.get('/api/calendar', async (req, res) => {
  try {
    const data = readData();

    // ── ICS Abo (hat Vorrang) ──────────────────────────────────────────────
    const icsUrl = data.calendar?.icsUrl;
    if (icsUrl) {
      const events = await fetchICS(icsUrl);
      return res.json(events);
    }

    // ── Microsoft Teams (Fallback) ─────────────────────────────────────────
    if (!data.teams?.enabled) return res.json([]);
    if (_calendarCache && Date.now() - _calendarCacheTime < 5 * 60 * 1000) return res.json(_calendarCache);
    const token = await getValidAccessToken();
    if (!token) return res.json([]);
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const evRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now.toISOString()}&endDateTime=${end}` +
      `&$select=subject,start,end,organizer,isAllDay&$orderby=start/dateTime&$top=10`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!evRes.ok) { const t = await evRes.text(); throw new Error('Graph error: ' + t); }
    const evData = await evRes.json();
    const events = (evData.value || []).map(e => ({
      subject: e.subject || '(Kein Titel)',
      start: e.isAllDay ? e.start?.date : e.start?.dateTime,
      end:   e.isAllDay ? e.end?.date   : e.end?.dateTime,
      organizer: e.organizer?.emailAddress?.name || '', isAllDay: !!e.isAllDay
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
    pushToGitHub(data); // nicht-blockierend
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── Webhook Auth ─────────────────────────────────────────────────────────────

function requireWebhookAuth(req, res, next) {
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: 'Webhooks deaktiviert (WEBHOOK_SECRET nicht gesetzt).' });
  const provided = req.query.key || '';
  let match = false;
  try {
    // Timing-safe Vergleich (verhindert Timing-Attacken auf den Key)
    const a = Buffer.alloc(WEBHOOK_SECRET.length, 0);
    const b = Buffer.alloc(WEBHOOK_SECRET.length, 0);
    a.write(provided.slice(0, WEBHOOK_SECRET.length));
    b.write(WEBHOOK_SECRET);
    match = provided.length === WEBHOOK_SECRET.length && crypto.timingSafeEqual(a, b);
  } catch {}
  if (!match) return res.status(401).json({ error: 'Ungültiger Webhook-Key.' });
  next();
}

// ── Webhook: KPI Update ───────────────────────────────────────────────────────
// Unterstützt zwei Formate:
// 1. Einzelner KPI:  { id, label, value, unit }
// 2. Alle Spalten:   { "Spaltenname": "Wert", ... } → Mapping aus smartsheet.kpiMapping
app.post('/webhook/kpi', requireWebhookAuth, (req, res) => {
  const { id, label, value, unit } = req.body;
  try {
    const data = readData();
    if (!data.kpis) data.kpis = [];

    // Format 2: Alle Spalten auf einmal (kein "id" im Body)
    if (!id) {
      const mapping = data.smartsheet?.kpiMapping || [];
      const updated = [];
      mapping.forEach(m => {
        if (!m.columnName || !(m.columnName in req.body)) return;
        const kpi = data.kpis.find(k => k.id === m.kpiId);
        if (!kpi) return;
        kpi.value  = String(req.body[m.columnName] ?? '').slice(0, 50);
        kpi.active = true;
        updated.push(m.kpiId);
      });
      if (!updated.length) return res.status(400).json({ error: 'Keine passenden Spalten im Mapping gefunden.' });
      writeData(data);
      scheduleContentPush(data);
      pushUpdate();
      return res.json({ ok: true, updated });
    }

    // Format 1: Einzelner KPI
    const kpi = data.kpis.find(k => k.id === Number(id));
    if (!kpi) return res.status(404).json({ error: 'KPI nicht gefunden.' });
    if (label !== undefined) kpi.label = String(label).slice(0, 100);
    if (value !== undefined) kpi.value = String(value).slice(0, 50);
    if (unit  !== undefined) kpi.unit  = String(unit).slice(0, 20);
    kpi.active = true;
    writeData(data);
    scheduleContentPush(data);
    pushUpdate();
    res.json({ ok: true, kpi });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── Webhook: Smartsheet via Zapier ───────────────────────────────────────────
// Zapier sendet bei Smartsheet-Änderung: { "SpaltenName": "Wert", ... }
// Jede eingehende Zeile wird in smartsheetRows[] gespeichert (max 50).
// Bestehende Zeile (gleicher "Client"-Wert) wird aktualisiert, sonst neu angelegt.
app.post('/webhook/smartsheet', requireWebhookAuth, (req, res) => {
  try {
    const data = readData();
    if (!data.smartsheetRows) data.smartsheetRows = [];

    // Alle Felder aus dem Body übernehmen (interne _-Keys ausschliessen)
    const fields = {};
    Object.entries(req.body).forEach(([k, v]) => {
      if (!k.startsWith('_')) fields[k] = String(v ?? '').slice(0, 200);
    });
    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: 'Leerer Body.' });
    }

    // Identifier: erster Feldwert als eindeutiger Key (z.B. "Client" oder "Project Name")
    const identifierKey = Object.keys(fields)[0];
    const identifierVal = fields[identifierKey];

    const existing = data.smartsheetRows.find(r => r.fields[identifierKey] === identifierVal);
    if (existing) {
      existing.fields     = fields;
      existing.updatedAt  = new Date().toISOString();
    } else {
      const maxId = data.smartsheetRows.reduce((n, r) => Math.max(n, r.id || 0), 0);
      data.smartsheetRows.push({
        id:        maxId + 1,
        active:    true,
        fields,
        updatedAt: new Date().toISOString()
      });
    }
    // Max 50 Zeilen (älteste entfernen)
    if (data.smartsheetRows.length > 50) data.smartsheetRows = data.smartsheetRows.slice(-50);

    const ss = data.smartsheet || {};
    data.smartsheet = { ...ss, lastSyncAt: new Date().toISOString(), lastSyncStatus: 'ok' };
    writeData(data);
    scheduleContentPush(data);
    pushUpdate();
    res.json({ ok: true, rows: data.smartsheetRows.length });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── API: Smartsheet-Zeile toggle (active/inactive) ────────────────────────────
app.post('/api/smartsheet-rows/:id/toggle', requireAuth, (req, res) => {
  try {
    const data = readData();
    const row = (data.smartsheetRows || []).find(r => r.id === parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ error: 'Zeile nicht gefunden.' });
    row.active = !row.active;
    writeData(data);
    scheduleContentPush(data);
    pushUpdate();
    res.json({ ok: true, id: row.id, active: row.active });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── API: Smartsheet-Zeile löschen ─────────────────────────────────────────────
app.delete('/api/smartsheet-rows/:id', requireAuth, (req, res) => {
  try {
    const data = readData();
    data.smartsheetRows = (data.smartsheetRows || []).filter(r => r.id !== parseInt(req.params.id, 10));
    writeData(data);
    scheduleContentPush(data);
    pushUpdate();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── Webhook: LASSO-Nachricht ──────────────────────────────────────────────────
app.post('/webhook/lasso-message', requireWebhookAuth, (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text fehlt.' });
  try {
    const data = readData();
    if (!data.lassoMessages) data.lassoMessages = [];
    const maxId = data.lassoMessages.reduce((m, msg) => Math.max(m, msg.id || 0), 0);
    const newMsg = {
      id: maxId + 1,
      text: String(text).slice(0, 500),
      source: 'lasso',
      active: true,
      updatedAt: new Date().toISOString()
    };
    data.lassoMessages.push(newMsg);
    // Max 10 – älteste entfernen (FIFO)
    if (data.lassoMessages.length > 10) data.lassoMessages = data.lassoMessages.slice(-10);
    writeData(data);
    scheduleContentPush(data);
    pushUpdate();
    res.json({ ok: true, message: newMsg });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── API: Webhook-Info (auth required) ────────────────────────────────────────
app.get('/api/webhook-info', requireAuth, (req, res) => {
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: 'Webhooks deaktiviert.' });
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host  = req.get('host');
  const base  = `${proto}://${host}`;
  res.json({
    kpiUrl:          `${base}/webhook/kpi`,
    lassoUrl:        `${base}/webhook/lasso-message`,
    smartsheetUrl:   `${base}/webhook/smartsheet`,
    keyPreview:      WEBHOOK_SECRET.slice(0, 4) + '****'
  });
});

// ── API: LASSO-Nachricht löschen (auth required) ──────────────────────────────
app.delete('/api/lasso-message/:id', requireAuth, (req, res) => {
  try {
    const data = readData();
    const id = parseInt(req.params.id, 10);
    data.lassoMessages = (data.lassoMessages || []).filter(m => m.id !== id);
    writeData(data);
    scheduleContentPush(data);
    pushUpdate();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// ── Smartsheet API Integration ────────────────────────────────────────────────

async function syncSmartsheet(data) {
  const ss = data.smartsheet;
  if (!ss) return;
  const { accessToken, sheetId, kpiMapping, messageMapping } = ss;
  try {
    const res = await fetch(`https://api.smartsheet.com/2.0/sheets/${sheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'satisfy-dashboard' }
    });
    if (!res.ok) {
      data.smartsheet.lastSyncStatus = 'error';
      writeData(data);
      console.error('Smartsheet sync HTTP', res.status);
      return;
    }
    const sheet = await res.json();

    // Spalten-Index: { "Spaltenname": columnId }
    const colIndex = {};
    (sheet.columns || []).forEach(c => { colIndex[c.title] = c.id; });

    // KPI-Mapping: letzte Zeile des Sheets
    const rows = sheet.rows || [];
    const lastRow = rows[rows.length - 1];
    if (lastRow && Array.isArray(kpiMapping)) {
      kpiMapping.forEach(m => {
        if (!m.columnName) return;
        const cell = lastRow.cells.find(c => c.columnId === colIndex[m.columnName]);
        const kpi = (data.kpis || []).find(k => k.id === m.kpiId);
        if (kpi && cell) kpi.value = String(cell.displayValue ?? cell.value ?? '');
      });
    }

    // Nachrichten-Mapping: alle Zeilen
    if (messageMapping?.enabled && messageMapping.columnName) {
      const newMessages = [];
      rows.forEach((row, i) => {
        const textCell = row.cells.find(c => c.columnId === colIndex[messageMapping.columnName]);
        if (!textCell?.value) return;
        const activeCell = messageMapping.activeColumnName
          ? row.cells.find(c => c.columnId === colIndex[messageMapping.activeColumnName])
          : null;
        newMessages.push({
          id: i + 1,
          text: String(textCell.value),
          priority: 'normal',
          active: activeCell ? Boolean(activeCell.value) : true
        });
      });
      data.messages = newMessages.slice(0, 50);
    }

    data.smartsheet.lastSyncAt = new Date().toISOString();
    data.smartsheet.lastSyncStatus = 'ok';
    data.smartsheet.sheetTitle = sheet.name || '';
    writeData(data);
    pushUpdate();
    scheduleContentPush(data);
    console.log('✓ Smartsheet sync erfolgreich:', sheet.name);
  } catch (e) {
    console.error('Smartsheet sync Fehler:', e.message);
    try {
      data.smartsheet.lastSyncStatus = 'error';
      writeData(data);
    } catch {}
  }
}

function startSmartsheetPoller() {
  async function poll() {
    const data = readData();
    if (!data.smartsheet?.enabled || !data.smartsheet?.accessToken) return;
    await syncSmartsheet(data);
  }
  poll();
  setInterval(poll, 5 * 60 * 1000);
}

// ── API: Smartsheet Status + manueller Sync ──────────────────────────────────
app.get('/api/smartsheet/status', requireAuth, (req, res) => {
  try {
    const data = readData();
    const ss = data.smartsheet || {};
    res.json({
      enabled: !!ss.enabled,
      lastSyncAt: ss.lastSyncAt || null,
      lastSyncStatus: ss.lastSyncStatus || 'never',
      sheetTitle: ss.sheetTitle || ''
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

app.post('/api/smartsheet/sync', requireAuth, async (req, res) => {
  try {
    const data = readData();
    if (!data.smartsheet?.enabled || !data.smartsheet?.accessToken) {
      return res.status(400).json({ error: 'Smartsheet nicht aktiviert oder kein Token.' });
    }
    await syncSmartsheet(data);
    const updated = readData();
    res.json({
      ok: true,
      lastSyncAt: updated.smartsheet?.lastSyncAt || null,
      lastSyncStatus: updated.smartsheet?.lastSyncStatus || 'error'
    });
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
      await pushToGitHub(data); // dauerhaft speichern
      console.log('\n  ⚠  Standard-Login angelegt: admin / 1234  ⚠');
      console.log('  Bitte PIN nach dem ersten Login ändern!\n');
    }
  } catch (e) {
    console.error('Fehler beim Initialisieren der Daten:', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  await pullFromGitHub(); // neueste Daten laden
  await ensureDefaultUser();
  startSmartsheetPoller();
  // Letzten Ping-Zeitstempel aus gespeicherten Daten wiederherstellen
  try { lastExternalPing = readData().meta?.lastPingAt || null; } catch {}
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
