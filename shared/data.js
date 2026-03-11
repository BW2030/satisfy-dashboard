// DataStore – automatically detects server vs. localStorage mode
// Sends Authorization header when a session token is available
const DataStore = (() => {
  const LS_KEY = 'firetv_content';
  const API_URL = '/api/content';
  let _serverAvailable = null;

  const defaultContent = {
    users: [{ name: 'admin', pin: '' }], // pin set by server on first run
    kpis: [
      { id: 1, label: 'KPI 1', value: '–', unit: '', active: true },
      { id: 2, label: 'KPI 2', value: '–', unit: '', active: true },
      { id: 3, label: 'KPI 3', value: '–', unit: '', active: true },
      { id: 4, label: '', value: '', unit: '', active: false },
      { id: 5, label: '', value: '', unit: '', active: false },
      { id: 6, label: '', value: '', unit: '', active: false }
    ],
    messages: [{ id: 1, text: 'Willkommen! Inhalte im Admin-Bereich anpassen.', priority: 'normal', active: true }],
    calendar: []
  };

  function _authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    // Auth module may not be loaded on display page – safe guard
    if (typeof Auth !== 'undefined' && Auth.getToken) {
      const token = Auth.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }

  async function checkServer() {
    if (_serverAvailable !== null) return _serverAvailable;
    try {
      const res = await fetch(API_URL, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
      _serverAvailable = res.ok || res.status === 401;
    } catch {
      _serverAvailable = false;
    }
    return _serverAvailable;
  }

  async function get() {
    if (await checkServer()) {
      try {
        const res = await fetch(API_URL, { headers: _authHeaders() });
        if (res.ok) return await res.json();
        // 401 = not logged in yet, use local fallback without crashing
        if (res.status === 401) return _fromLocalStorage();
      } catch {}
    }
    return _fromLocalStorage();
  }

  function _fromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return JSON.parse(JSON.stringify(defaultContent));
  }

  async function save(data) {
    if (await checkServer()) {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: _authHeaders(),
          body: JSON.stringify(data)
        });
        if (res.ok) return true;
      } catch {}
    }
    // localStorage fallback
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function resetServerCheck() {
    _serverAvailable = null;
  }

  return { get, save, checkServer, resetServerCheck };
})();
