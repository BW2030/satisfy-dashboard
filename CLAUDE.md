# FireTV Dashboard – Projektdokumentation v2

> Diese Datei ist die vollständige Übergabe-Dokumentation für Claude Code.
> Lies diese Datei am Anfang jeder neuen Session, um sofort arbeitsfähig zu sein.

---

## Projektübersicht

**Was es ist:** Kiosk-Webseite die dauerhaft auf einem Amazon Fire TV Stick läuft.
**Betreiber:** satis&fy LLC
**Live-URL:** https://satisfy-dashboard.onrender.com
**GitHub:** https://github.com/BW2030/satisfy-dashboard
**Lokaler Pfad:** `/Users/admin/firetv-dashboard/`

---

## Tech Stack

| Bereich | Technologie |
|---------|------------|
| Frontend | Vanilla HTML / CSS / JavaScript (kein Framework) |
| Backend | Node.js + Express (nur `express` als Dependency) |
| Hosting | Render.com (Free Tier, schläft nach Inaktivität) |
| Datenbank | GitHub API als Pseudo-DB (`data/content.json`) |
| Auth | PBKDF2-PIN (+ Microsoft OAuth als Option) |
| Realtime | Server-Sent Events (SSE) |

---

## Dateistruktur

```
/firetv-dashboard/
├── server.js                  # Express-Backend (alle API-Routen)
├── package.json               # Nur "express" als Dependency
├── render.yaml                # Render.com Deploy-Konfiguration
├── CLAUDE.md                  # Diese Datei (Projektdoku für Claude)
├── data/
│   └── content.json           # Live-Datenbank (wird via GitHub API verwaltet)
├── admin/
│   ├── index.html             # Admin-Dashboard (geschützt, nach Login)
│   └── login.html             # Login-Seite (PIN + Microsoft OAuth)
├── display/
│   ├── index.html             # Haupt-Display (Kiosk-Ansicht)
│   ├── calendar.html          # Kalender-Ansicht (für Rotation)
│   └── embed.html             # Embed-URL Ansicht (?slot=1..5)
└── shared/
    ├── style.css              # Globales CSS (Dark Theme Admin + Light Theme Display)
    ├── auth.js                # Client-seitige Auth-Logik (PBKDF2, Sessions)
    ├── data.js                # DataStore (API-Calls oder localStorage-Fallback)
    └── i18n.js                # Deutsch/Englisch Übersetzungen
```

---

## Zwei Betriebsmodi

### 1. Server-Modus (Render.com / lokal)
- Daten werden via `GET/POST /api/content` gelesen/geschrieben
- Login via `POST /api/login` → Token-basierte Server-Session
- Daten werden nach jedem Save in GitHub gepusht (persistiert über Restarts)
- SSE (`/api/events`) pushed Änderungen live ans Display

### 2. GitHub Pages Modus (Offline / Fallback)
- Kein Server → DataStore nutzt `localStorage`
- Login über Client-seitige PBKDF2-Verifikation
- Kein GitHub Push möglich

---

## Datenbank: `data/content.json`

**WICHTIG:** Diese Datei NIEMALS manuell committen! Sie wird vom Server via GitHub API verwaltet. Manuelles Committen überschreibt Live-Daten.

### Struktur

```json
{
  "users": [
    { "name": "admin", "pin": "salt:pbkdf2hash" }
  ],
  "widgets": {
    "clock": true,
    "infoboard": true,
    "showPing": false,
    "animals": false,
    "calendar": true,
    "weather": { "enabled": false, "city": "New York", "lat": 40.7128, "lon": -74.006 },
    "embedUrl": "",
    "embedSlots": [
      { "id": 2, "label": "Embed 2", "url": "", "active": false },
      { "id": 3, "label": "Embed 3", "url": "", "active": false },
      { "id": 4, "label": "Embed 4", "url": "", "active": false },
      { "id": 5, "label": "Embed 5", "url": "", "active": false }
    ]
  },
  "kpis": [
    { "id": 1, "label": "", "value": "", "unit": "", "active": false }
    // ... bis id 6
  ],
  "messages": [
    { "id": 1, "text": "...", "priority": "normal|important|urgent", "active": true }
  ],
  "calendar": { "icsUrl": "" },
  "pages": { "active": "display|calendar|embed|auto|web", "rotationSec": 30 },
  "teams": { "enabled": false, "tenantId": "", "clientId": "", "userEmail": "" },
  "lassoMessages": [
    { "id": 1, "text": "...", "source": "lasso", "active": true, "updatedAt": "ISO" }
  ],
  "meta": { "lastPingAt": "ISO-8601-Timestamp" }
}
```

---

## Server-Routen (`server.js`)

| Route | Methode | Auth | Beschreibung |
|-------|---------|------|-------------|
| `/ping` | GET | Nein | Keep-Alive von cron-job.org; speichert Timestamp |
| `/api/last-ping` | GET | Nein | Gibt letzten Ping-Timestamp zurück |
| `/api/login` | POST | Nein | PIN-Login → gibt Token zurück |
| `/api/content` | GET | Nein | Gibt Daten zurück (PINs herausgefiltert) |
| `/api/content` | POST | Ja | Speichert Daten + pushed zu GitHub |
| `/api/change-pin` | POST | Ja | PIN ändern |
| `/api/events` | GET | Nein | SSE-Stream für Live-Updates |
| `/api/calendar` | GET | Ja | Kalenderdaten (ICS oder Teams) |
| `/api/teams-status` | GET | Ja | Microsoft Teams Login-Status |
| `/api/teams-logout` | POST | Ja | Teams-Token löschen |
| `/auth/microsoft/login` | GET | Nein | OAuth für Teams-Kalender |
| `/auth/microsoft/callback` | GET | Nein | OAuth-Callback Kalender |
| `/auth/microsoft/admin-login` | GET | Nein | OAuth für Admin-Login |
| `/auth/microsoft/admin-callback` | GET | Nein | OAuth-Callback Admin |

---

## Authentifizierung

### PIN-Login (primär)
- Default-Zugangsdaten: `admin` / `1234`
- Hash-Format: `PBKDF2` → `salt:hash` (je 32 Hex-Zeichen)
- `ensureDefaultUser()` erstellt admin/1234 falls keine User existieren
- `verifyPin()` unterstützt altes SHA-256 Format als Fallback

### Microsoft OAuth (optional)
- Admin-Login: `/auth/microsoft/admin-login` → Callback gibt `?_t=TOKEN&_n=NAME` an login.html
- Teams-Kalender: separater OAuth-Flow mit `Calendars.Read`-Scope
- Benötigt Azure AD App mit Tenant ID, Client ID, Client Secret

---

## Display-Seiten & Rotation

### Rotationsmodi (`pages.active`)
| Wert | Beschreibung |
|------|-------------|
| `display` | Nur Haupt-Display (statisch) |
| `calendar` | Nur Kalender (statisch) |
| `embed` | Nur Embed Slot 1 (statisch) |
| `auto` | Auto-Rotation: display → calendar → embed-slots |
| `web` | Nur Embed-Slots rotieren (kein Display/Kalender) |

### `buildSequence(data)` Funktion
Alle drei Display-Seiten (index.html, calendar.html, embed.html) teilen diese Logik:
- Baut Sequenz basierend auf `pages.active` und aktiven Embed-Slots
- Jede Seite findet ihre Position in der Sequenz und navigiert zur nächsten
- Embed Slot 1 → `?slot=1`, Slot 2-5 → `?slot=2` bis `?slot=5`

### Embed-Slots
- Slot 1: `widgets.embedUrl` (immer aktiv wenn URL gesetzt)
- Slot 2-5: `widgets.embedSlots[{id, url, active}]`
- URL: `embed.html?slot=N`

---

## CSS-Architektur (`shared/style.css`)

### Dark Theme (Admin + Login)
```css
:root {
  --bg: #111111; --surface: #1c1c1c; --surface2: #262626;
  --border: #333333; --accent: #dc2626; --accent2: #b91c1c;
  --text: #f0f0f0; --muted: #6b7280;
  --success: #22c55e; --warning: #f59e0b; --danger: #ef4444;
  --radius: 10px;
}
```

### Light Theme (Display-Seiten)
```css
.display-body {
  --bg: #f5f5f3; --surface: #ffffff; --surface2: #efefed;
  --border: #e0e0dc; --accent: #dc2626; --accent2: #b91c1c;
  --text: #111111; --muted: #6b7280;
}
```

**Accent-Farbe ist überall satis&fy-Rot (`#dc2626`).**

### Admin-Section Pattern
```html
<section class="admin-section">
  <h2 class="admin-section-title">
    <div class="section-icon"></div>   <!-- roter linker Balken -->
    Titel
  </h2>
  <div class="admin-section-body">
    <!-- Inhalt -->
  </div>
</section>
```

---

## Wichtige Lessons Learned / Fallstricke

### ❌ `data/content.json` NIE manuell committen
Führt dazu, dass Live-Daten (PINs, gespeicherte Einstellungen) überschrieben werden.
**Fix wenn passiert:** `"users": []` in content.json setzen → committen → pushen → `ensureDefaultUser()` erstellt admin/1234 neu.

### ❌ Git Push ohne Pull
Render pushed auto-saves ("auto-save: dashboard content") wenn Daten gespeichert werden.
Immer `git pull --rebase && git push` verwenden.

### ⚠️ Render Free Tier schläft
Server schläft nach ~15 Minuten Inaktivität. Cron-job.org pingt `/ping` alle 5 Minuten.
Ping-Timestamp wird in `meta.lastPingAt` gespeichert und beim Restart wiederhergestellt.

### ⚠️ Render Disk ist nicht persistent
Bei jedem Deploy/Restart wird der Disk-Stand aus GitHub geladen (`pullFromGitHub()` beim Start).
Deshalb ist GitHub die einzige persistente Datenquelle.

### ⚠️ WebFetch cached 15 Minuten
Das Claude-Tool `WebFetch` cached URLs 15 Minuten. Ping-Checks können veraltet sein.

---

## Stand letzter Session (2026-03-13)

### In dieser Session implementiert (v2 Feature-Branch → main)

1. **Zapier Webhook + LASSO Info-Tafel**
   - `POST /webhook/kpi?key=SECRET` – KPI per Webhook aktualisieren
   - `POST /webhook/lasso-message?key=SECRET` – LASSO-Nachricht pushen (max 10, FIFO)
   - `GET /api/webhook-info` (auth) – Webhook-URLs + Key-Preview
   - `DELETE /api/lasso-message/:id` (auth) – LASSO-Nachricht löschen
   - `WEBHOOK_SECRET` Env-Variable in Render.com setzen
   - Zweite Info-Tafel auf display/index.html und display/slide.html
   - Admin: LASSO-Toggle + Webhook-Info-Box + LASSO-Nachrichten-Vorschau

2. **CSS Grid Fix** – `.info-boards-wrap` Flex-Container verhindert Kalender-Overflow

3. **SSE Fix in slide.html** – `_sseConnected` Flag, reconnect reload, 60s Fallback-Timer

4. **Ping-Persistenz** – `/ping` pusht max alle 10 Min zu GitHub, überlebt Server-Restarts

5. **Display-Vorschau im Admin** – `📺 Aktive Ausgänge` Sektion mit skalierten iframes
   - `?preview=1` URL-Parameter in allen 4 Display-Seiten (deaktiviert Rotation)
   - Admin zeigt alle aktiven Ausgänge als 320×180px Thumbnails mit Öffnen-Link

### Bekannte Fallstricke
- Nach jedem Render.com Deploy: Session abgelaufen → neu einloggen
- `WEBHOOK_SECRET` muss in Render.com Environment Variables gesetzt sein
- `pages.active` muss auf `display` oder `auto` stehen (nicht `web`) damit Display läuft

---

## Offene Aufgaben (Stand: März 2026)

| Priorität | Aufgabe |
|-----------|---------|
| Mittel | Azure AD App einrichten (Tenant ID, Client ID, Client Secret) für Teams-Login |
| Niedrig | Display-Design weiterer Feinschliff |

### Azure AD Setup (wenn bereit)
1. Azure Portal → App-Registrierungen → Neu
2. Redirect URIs eintragen:
   - `https://satisfy-dashboard.onrender.com/auth/microsoft/callback` (Kalender)
   - `https://satisfy-dashboard.onrender.com/auth/microsoft/admin-callback` (Admin-Login)
3. API-Permissions: `Calendars.Read` (Delegated) + `offline_access` + `openid` + `profile` + `email`
4. Client Secret erstellen
5. In Admin-Dashboard unter Kalender → Microsoft Teams → Tenant ID / Client ID / Secret eintragen

---

## Entwicklung lokal

```bash
cd /Users/admin/firetv-dashboard
npm install
node server.js
# → http://localhost:3000/display/
# → http://localhost:3000/admin/login.html
```

---

## Git Workflow

```bash
# Änderungen committen
git add shared/style.css admin/index.html  # Nur spezifische Dateien!
git commit -m "Beschreibung"

# Pushen (IMMER erst pullen wegen auto-saves vom Server)
git pull --rebase && git push
```

---

## Umgebungsvariablen (Render.com)

| Variable | Zweck |
|----------|-------|
| `GITHUB_TOKEN` | GitHub API Token für Lesen/Schreiben von content.json |
| `MICROSOFT_CLIENT_SECRET` | Azure AD Client Secret (optional, für Teams) |
| `PORT` | Wird von Render gesetzt (Standard: 3000) |
| `RENDER` | Wird von Render gesetzt (Server erkennt Hosting-Umgebung) |
