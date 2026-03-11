// i18n – Translations for DE / EN
const I18n = (() => {
  const LS_KEY = 'firetv_lang';

  const translations = {
    de: {
      // Login
      'login.subtitle':       'Bitte mit Name und PIN anmelden',
      'login.label.name':     'Name',
      'login.label.pin':      '4-stelliger PIN',
      'login.btn':            'Anmelden',
      'login.btn.checking':   'Prüfe...',
      'login.session.note':   'Session läuft nach 8 Stunden ab.',
      'login.err.pin.length': 'Bitte einen 4-stelligen PIN eingeben.',
      'login.err.locked':     'Zu viele Fehlversuche. Bitte {min} Minute(n) warten.',
      'login.err.invalid':    'Name oder PIN falsch.',
      'login.err.attempts':   'Noch {n} Versuch(e).',

      // Nav
      'nav.open.display':  'Anzeige öffnen',
      'nav.logout':        'Abmelden',
      'nav.mode.local':    'Lokal (Server)',
      'nav.mode.static':   'Statisch (localStorage)',

      // Sections
      'section.kpis':      'KPI-Kacheln',
      'section.info':      'Info-Tafel',
      'section.calendar':  'Kalender',
      'section.account':   'Konto-Einstellungen',

      // KPIs
      'kpi.placeholder.label': 'Bezeichnung',
      'kpi.placeholder.value': 'Wert',
      'kpi.placeholder.unit':  'Einheit',

      // Messages
      'msg.placeholder':     'Neue Nachricht eingeben...',
      'msg.add':             '+ Hinzufügen',
      'msg.priority.normal':    'Normal',
      'msg.priority.important': 'Wichtig',
      'msg.priority.urgent':    'Dringend',
      'msg.delete':          'Löschen',

      // Calendar
      'calendar.soon': 'Kalender-Integration folgt in einer späteren Version.',

      // Account
      'account.subtitle':    'PIN für {user} ändern',
      'account.current.pin': 'Aktueller PIN',
      'account.new.pin':     'Neuer PIN',
      'account.confirm.pin': 'PIN bestätigen',
      'account.btn.change':  'PIN ändern',
      'account.err.length':  'Alle PINs müssen 4 Stellen haben.',
      'account.err.match':   'Neuer PIN und Bestätigung stimmen nicht überein.',
      'account.err.wrong':   '✗ Aktueller PIN falsch.',
      'account.ok':          '✓ PIN erfolgreich geändert.',

      // Save
      'save.btn':    '💾 Speichern',
      'save.ok':     '✓ Gespeichert!',
      'save.error':  '✗ Fehler beim Speichern',

      // Widgets section
      'section.widgets':          'Widgets',
      'widget.clock.label':       'Uhr & Datum',
      'widget.clock.desc':        'Große Uhr oben links im Display',
      'widget.weather.label':     'Wetter',
      'widget.weather.desc':      'Aktuelles Wetter (Open-Meteo)',
      'widget.weather.city':      'Stadt / Ort',
      'widget.weather.search':    'Suchen',
      'widget.weather.found':     'Gefunden: {city} ({lat}, {lon})',
      'widget.weather.not.found': 'Ort nicht gefunden.',
      'widget.animals.label':     'Tier-Parade 🐾',
      'widget.animals.desc':      'Lustige Tiere rennen über das Display',

      // Display labels
      'display.no.messages': 'Keine Nachrichten vorhanden.',

      // Teams Calendar
      'teams.label':      'Microsoft Teams Kalender',
      'teams.desc':       'Termine über Microsoft Graph API anzeigen',
      'teams.tenant':     'Tenant ID',
      'teams.client':     'Client ID (App ID)',
      'teams.secret':     'Client Secret',
      'teams.email':      'Kalender E-Mail / UPN',
      'teams.test':       'Verbindung testen',
      'teams.test.ok':    '{n} Termin(e) gefunden',
      'teams.help.title': 'Azure AD Setup:',
      'teams.help.text':  ' portal.azure.com → App registrations → New → API permissions: Calendars.Read (Application) → Admin consent → Certificates & secrets → New secret',
    },

    en: {
      // Login
      'login.subtitle':       'Please sign in with name and PIN',
      'login.label.name':     'Name',
      'login.label.pin':      '4-digit PIN',
      'login.btn':            'Sign In',
      'login.btn.checking':   'Checking...',
      'login.session.note':   'Session expires after 8 hours.',
      'login.err.pin.length': 'Please enter a 4-digit PIN.',
      'login.err.locked':     'Too many failed attempts. Please wait {min} minute(s).',
      'login.err.invalid':    'Name or PIN incorrect.',
      'login.err.attempts':   '{n} attempt(s) remaining.',

      // Nav
      'nav.open.display':  'Open Display',
      'nav.logout':        'Sign Out',
      'nav.mode.local':    'Local (Server)',
      'nav.mode.static':   'Static (localStorage)',

      // Sections
      'section.kpis':      'KPI Tiles',
      'section.info':      'Info Board',
      'section.calendar':  'Calendar',
      'section.account':   'Account Settings',

      // KPIs
      'kpi.placeholder.label': 'Label',
      'kpi.placeholder.value': 'Value',
      'kpi.placeholder.unit':  'Unit',

      // Messages
      'msg.placeholder':     'Enter new message...',
      'msg.add':             '+ Add',
      'msg.priority.normal':    'Normal',
      'msg.priority.important': 'Important',
      'msg.priority.urgent':    'Urgent',
      'msg.delete':          'Delete',

      // Calendar
      'calendar.soon': 'Calendar integration coming in a later version.',

      // Account
      'account.subtitle':    'Change PIN for {user}',
      'account.current.pin': 'Current PIN',
      'account.new.pin':     'New PIN',
      'account.confirm.pin': 'Confirm PIN',
      'account.btn.change':  'Change PIN',
      'account.err.length':  'All PINs must be 4 digits.',
      'account.err.match':   'New PIN and confirmation do not match.',
      'account.err.wrong':   '✗ Current PIN incorrect.',
      'account.ok':          '✓ PIN changed successfully.',

      // Save
      'save.btn':    '💾 Save',
      'save.ok':     '✓ Saved!',
      'save.error':  '✗ Error saving',

      // Widgets section
      'section.widgets':          'Widgets',
      'widget.clock.label':       'Clock & Date',
      'widget.clock.desc':        'Large clock in the top left of the display',
      'widget.weather.label':     'Weather',
      'widget.weather.desc':      'Current weather (Open-Meteo)',
      'widget.weather.city':      'City / Location',
      'widget.weather.search':    'Search',
      'widget.weather.found':     'Found: {city} ({lat}, {lon})',
      'widget.weather.not.found': 'Location not found.',
      'widget.animals.label':     'Animal Parade 🐾',
      'widget.animals.desc':      'Fun animals running across the display',

      // Display labels
      'display.no.messages': 'No messages available.',

      // Teams Calendar
      'teams.label':      'Microsoft Teams Calendar',
      'teams.desc':       'Show meetings via Microsoft Graph API',
      'teams.tenant':     'Tenant ID',
      'teams.client':     'Client ID (App ID)',
      'teams.secret':     'Client Secret',
      'teams.email':      'Calendar Email / UPN',
      'teams.test':       'Test connection',
      'teams.test.ok':    '{n} event(s) found',
      'teams.help.title': 'Azure AD Setup:',
      'teams.help.text':  ' portal.azure.com → App registrations → New → API permissions: Calendars.Read (Application) → Admin consent → Certificates & secrets → New secret',
    }
  };

  let _lang = localStorage.getItem(LS_KEY) || 'de';

  function t(key, vars = {}) {
    let str = (translations[_lang] || translations['de'])[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  }

  function getLang() { return _lang; }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem(LS_KEY, lang);
    applyToDOM();
  }

  function toggle() {
    setLang(_lang === 'de' ? 'en' : 'de');
  }

  // Apply translations to all elements with data-i18n attribute
  function applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : {};
      el.textContent = t(key, vars);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    // Update toggle button label
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.textContent = _lang === 'de' ? 'EN' : 'DE';
      btn.title = _lang === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln';
    });
  }

  return { t, getLang, setLang, toggle, applyToDOM };
})();
