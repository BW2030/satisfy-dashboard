// Auth module – Login/Session management
// Uses PBKDF2 with salt for secure PIN hashing
// When server is available: server-side validation + token-based sessions
// When no server (GitHub Pages): client-side validation with localStorage

const Auth = (() => {
  const SESSION_KEY = 'firetv_admin_session';
  const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

  // ── Hashing (PBKDF2 + Salt) ──────────────────────────────────────────────

  async function hashPin(pin, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function createHash(pin) {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);
    return `${salt}:${hash}`;
  }

  async function verifyPin(pin, stored) {
    // Support both old format (plain SHA-256) and new format (salt:hash)
    if (stored.includes(':')) {
      const [salt, hash] = stored.split(':');
      const computed = await hashPin(pin, salt);
      return computed === hash;
    }
    // Legacy SHA-256 fallback (will be upgraded on next PIN change)
    const msgBuffer = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const legacy = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return legacy === stored;
  }

  // ── Rate Limiting (client-side) ──────────────────────────────────────────

  const FAIL_LIMIT = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  function getLockoutState(name) {
    try {
      return JSON.parse(sessionStorage.getItem('firetv_lockout_' + name)) || { attempts: 0, lockedUntil: 0 };
    } catch { return { attempts: 0, lockedUntil: 0 }; }
  }

  function recordFail(name) {
    const state = getLockoutState(name);
    state.attempts++;
    if (state.attempts >= FAIL_LIMIT) {
      state.lockedUntil = Date.now() + LOCKOUT_MS;
      state.attempts = 0;
    }
    sessionStorage.setItem('firetv_lockout_' + name, JSON.stringify(state));
    return state;
  }

  function clearFail(name) {
    sessionStorage.removeItem('firetv_lockout_' + name);
  }

  function getRemainingLockout(name) {
    const state = getLockoutState(name);
    if (state.lockedUntil > Date.now()) {
      return Math.ceil((state.lockedUntil - Date.now()) / 1000);
    }
    return 0;
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async function login(name, pin) {
    // Check lockout
    const lockRemaining = getRemainingLockout(name);
    if (lockRemaining > 0) {
      return { ok: false, lockedFor: lockRemaining };
    }

    // Try server-side login first
    const serverAvailable = await DataStore.checkServer();
    if (serverAvailable) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, pin })
        });
        if (res.ok) {
          const { token } = await res.json();
          _setSession(name, token);
          clearFail(name);
          return { ok: true };
        } else if (res.status === 429) {
          return { ok: false, lockedFor: 900 };
        } else {
          const state = recordFail(name);
          return { ok: false, attemptsLeft: FAIL_LIMIT - state.attempts };
        }
      } catch {}
    }

    // Fallback: client-side validation (GitHub Pages mode)
    const data = await DataStore.get();
    const users = data.users || [];
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (user && await verifyPin(pin, user.pin)) {
      _setSession(name, null);
      clearFail(name);
      return { ok: true };
    }
    const state = recordFail(name);
    return { ok: false, attemptsLeft: FAIL_LIMIT - state.attempts };
  }

  function _setSession(name, token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      name,
      token: token || null,
      loggedIn: true,
      expiresAt: Date.now() + SESSION_DURATION_MS
    }));
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (!s || !s.loggedIn) return null;
      if (s.expiresAt && Date.now() > s.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch { return null; }
  }

  function isLoggedIn() {
    return getSession() !== null;
  }

  function requireLogin() {
    if (!isLoggedIn()) window.location.href = 'login.html';
  }

  function getCurrentUser() {
    return getSession();
  }

  function getToken() {
    return getSession()?.token || null;
  }

  // ── PIN Change ───────────────────────────────────────────────────────────

  async function changePin(name, currentPin, newPin) {
    // Server-side change
    const serverAvailable = await DataStore.checkServer();
    if (serverAvailable) {
      const token = getToken();
      try {
        const res = await fetch('/api/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ name, currentPin, newPin })
        });
        return res.ok;
      } catch {}
    }

    // Fallback: client-side change (GitHub Pages mode)
    const data = await DataStore.get();
    const users = data.users || [];
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user || !(await verifyPin(currentPin, user.pin))) return false;
    user.pin = await createHash(newPin);
    await DataStore.save(data);
    return true;
  }

  return { login, logout, isLoggedIn, requireLogin, getCurrentUser, getToken, changePin, createHash, verifyPin };
})();
