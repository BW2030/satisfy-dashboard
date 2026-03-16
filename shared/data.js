// DataStore – automatically detects server vs. localStorage mode
// Sends Authorization header when a session token is available
const DataStore = (() => {
  const LS_KEY = 'firetv_content';
  const API_URL = '/api/content';
  let _serverAvailable = null;

  const defaultContent = {
    users: [{ name: 'admin', pin: '' }],
    kpis: [
      { id: 1, label: '', value: '', unit: '', active: false },
      { id: 2, label: '', value: '', unit: '', active: false },
      { id: 3, label: '', value: '', unit: '', active: false },
      { id: 4, label: '', value: '', unit: '', active: false },
      { id: 5, label: '', value: '', unit: '', active: false },
      { id: 6, label: '', value: '', unit: '', active: false }
    ],
    messages: [{ id: 1, text: 'Willkommen! Inhalte im Admin-Bereich anpassen.', priority: 'normal', active: true }],
    lassoMessages: [],
    calendar: {},
    widgets: {
      clock: true, infoboard: true, showPing: false, animals: false, calendar: true,
      lassoBoard: false,
      weather: { enabled: false, city: 'New York', lat: 40.7128, lon: -74.006 },
      embedUrl: '',
      embedSlots: [
        { id: 2, label: 'Embed 2', url: '', active: false },
        { id: 3, label: 'Embed 3', url: '', active: false },
        { id: 4, label: 'Embed 4', url: '', active: false },
        { id: 5, label: 'Embed 5', url: '', active: false }
      ]
    },
    pages: { active: 'display', rotationSec: 30 },
    smartsheet: {
      enabled: false,
      accessToken: '',
      sheetId: '',
      kpiMapping: [
        { kpiId: 1, columnName: '' },
        { kpiId: 2, columnName: '' },
        { kpiId: 3, columnName: '' },
        { kpiId: 4, columnName: '' },
        { kpiId: 5, columnName: '' },
        { kpiId: 6, columnName: '' }
      ],
      messageMapping: { enabled: false, columnName: '', activeColumnName: '' },
      lastSyncAt: null,
      lastSyncStatus: 'never'
    },
    slides: [
      { id: 1, name: 'Termine',   type: 'calendar',  url: '', content: '', active: false },
      { id: 2, name: 'Dashboard', type: 'dashboard', url: '', content: '', active: false },
      { id: 3, name: 'Slide 3',   type: 'text',      url: '', content: '', active: false },
      { id: 4, name: 'Slide 4',   type: 'embed',     url: '', content: '', active: false },
      { id: 5, name: 'Slide 5',   type: 'text',      url: '', content: '', active: false }
    ]
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
        if (res.ok) return { ok: true, server: true };
        if (res.status === 401) return { ok: false, authExpired: true };
      } catch {}
    }
    // localStorage fallback (GitHub Pages / offline)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return { ok: true, server: false };
    } catch {
      return { ok: false };
    }
  }

  function resetServerCheck() {
    _serverAvailable = null;
  }

  return { get, save, checkServer, resetServerCheck };
})();
