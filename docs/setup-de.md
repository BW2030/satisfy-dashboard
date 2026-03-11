# satis&fy Dashboard – Setup-Anleitung (Deutsch)

---

## Schnellzugriff – Alle Links

> **Aktuelle IP des Dashboard-Servers: `192.168.1.232`**
>
> ⚠️ Diese IP kann sich ändern (siehe [Feste IP-Adresse einrichten](#feste-ip-adresse-einrichten)).

| Seite | Link |
|-------|------|
| 📺 **Display** (Fire TV öffnet diese URL) | http://192.168.1.232:3000/display/ |
| 🔐 **Admin-Login** | http://192.168.1.232:3000/admin/login.html |
| 🎛️ **Admin-Dashboard** (nach Login) | http://192.168.1.232:3000/admin/index.html |
| 🏠 **Startseite** (leitet zu Display weiter) | http://192.168.1.232:3000/ |

**Standard-Login:** Name `admin` · PIN `1234`
*(Bitte nach dem ersten Login unter „Konto-Einstellungen" ändern!)*

---

## ⚠️ Ändert sich die IP-Adresse?

**Ja** – standardmäßig vergibt dein Router per DHCP jedes Mal eine neue IP, wenn der PC neu startet oder sich neu mit dem Netzwerk verbindet. Das bedeutet: Die obigen Links könnten nach einem Neustart nicht mehr funktionieren.

### Feste IP-Adresse einrichten

Es gibt zwei Wege, die IP dauerhaft zu fixieren:

#### Option A – Feste IP im Router (empfohlen)

1. Öffne die Router-Oberfläche in deinem Browser (meist `http://192.168.1.1` oder `http://fritz.box`)
2. Suche nach **DHCP** → **Adress-Reservierung** (bei FritzBox: *Heimnetz → Netzwerk → IP-Adressen*)
3. Wähle den Windows-PC aus der Liste der verbundenen Geräte
4. Weise ihm eine **feste IP** zu, z.B. `192.168.1.232`
5. Speichern und Router neu starten
6. Ab jetzt hat der PC immer dieselbe IP – alle Links bleiben gültig ✓

#### Option B – Feste IP direkt auf dem Windows-PC

1. Drücke `Win + R`, tippe `ncpa.cpl`, drücke Enter
2. Rechtsklick auf deine Netzwerkverbindung → **Eigenschaften**
3. Doppelklick auf **„Internetprotokoll Version 4 (TCP/IPv4)"**
4. Wähle **„Folgende IP-Adresse verwenden"**
5. Fülle aus:
   - IP-Adresse: `192.168.1.232`
   - Subnetzmaske: `255.255.255.0`
   - Standardgateway: `192.168.1.1` *(deine Router-IP)*
   - DNS-Server: `8.8.8.8`
6. Klicke **OK** → **OK**

> Nach dem Einrichten einer festen IP sind alle Links dauerhaft gültig und müssen nie angepasst werden.

---

## Inhaltsverzeichnis

0. [Online-Hosting mit Render.com (empfohlen)](#0-online-hosting-mit-rendercom-empfohlen)
1. [Voraussetzungen](#1-voraussetzungen)
2. [Projekt einrichten](#2-projekt-einrichten)
3. [Server starten](#3-server-starten)
4. [Eigenen Hostnamen einrichten (optional)](#4-eigenen-hostnamen-einrichten-optional)
5. [Autostart auf Windows einrichten](#5-autostart-auf-windows-einrichten)
6. [Fire TV Stick einrichten](#6-fire-tv-stick-einrichten)
7. [Admin-Bereich bedienen](#7-admin-bereich-bedienen)
8. [GitHub Pages (zweite Version)](#8-github-pages-zweite-version)
9. [Fehlerbehebung](#9-fehlerbehebung)

---

## 0. Online-Hosting mit Render.com (empfohlen)

Kein Windows-PC nötig – das Dashboard läuft komplett in der Cloud. Der Fire TV Stick öffnet einfach die Render-URL.

### Schritt 1 – GitHub-Repository erstellen

1. Gehe zu **https://github.com** und erstelle einen kostenlosen Account (falls noch nicht vorhanden)
2. Klicke oben rechts auf **„+"** → **„New repository"**
3. Name: `satisfy-dashboard` → **„Public"** → **„Create repository"**
4. Öffne auf diesem Mac das Terminal und führe aus:
   ```bash
   cd /Users/admin/firetv-dashboard
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/DEIN-USERNAME/satisfy-dashboard.git
   git push -u origin main
   ```
   *(Ersetze `DEIN-USERNAME` mit deinem GitHub-Benutzernamen)*

### Schritt 2 – Render.com Account erstellen

1. Gehe zu **https://render.com**
2. Klicke auf **„Get Started for Free"**
3. Wähle **„Continue with GitHub"** → Autorisiere Render

### Schritt 3 – Neuen Web Service erstellen

1. Klicke im Render-Dashboard auf **„New +"** → **„Web Service"**
2. Wähle **„Build and deploy from a Git repository"** → **„Next"**
3. Verbinde dein GitHub-Repository `satisfy-dashboard`
4. Fülle das Formular aus:

   | Feld | Wert |
   |------|------|
   | **Name** | `satisfy-dashboard` |
   | **Region** | `Oregon (US West)` |
   | **Branch** | `main` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | `Free` |

5. Klicke **„Create Web Service"**
6. Render baut das Projekt automatisch (~2 Minuten)
7. Du siehst die URL oben: `https://satisfy-dashboard.onrender.com`

### Schritt 4 – Dashboard aufrufen

Deine Links sind jetzt:

| Seite | URL |
|-------|-----|
| 📺 **Display** | `https://satisfy-dashboard.onrender.com/display/` |
| 🔐 **Admin-Login** | `https://satisfy-dashboard.onrender.com/admin/login.html` |

**Standard-Login:** Name `admin` · PIN `1234`

### Schritt 5 – Auto-Ping einrichten (verhindert Einschlafen)

Render schläft nach 15 Minuten ohne Anfragen ein. So verhinderst du das kostenlos:

1. Gehe zu **https://cron-job.org** und erstelle einen kostenlosen Account
2. Klicke auf **„CREATE CRONJOB"**
3. Fülle aus:
   - **Title:** `Dashboard Keep-Alive`
   - **URL:** `https://satisfy-dashboard.onrender.com/ping`
   - **Schedule:** Alle **10 Minuten** (klicke auf „Every 10 minutes")
4. Klicke **„CREATE"**
5. ✅ Das Dashboard läuft jetzt 24/7 ohne Unterbrechung

### Schritt 6 – Fire TV Stick einrichten

1. Öffne den **Silk Browser** auf dem Fire TV
2. Gib ein: `https://satisfy-dashboard.onrender.com/display/`
3. Lesezeichen setzen → fertig!

> **Hinweis zu den Daten:** Wenn Render den Server neu startet (z.B. nach einem Update), werden Änderungen die du im Admin gemacht hast zurückgesetzt. Um deine Standarddaten dauerhaft zu speichern: Ändere die Werte in `data/content.json` → Pushe auf GitHub → Render deployt automatisch neu.

---

## 1. Voraussetzungen

### Was du brauchst
- Windows-PC oder -Server im lokalen Netzwerk (immer eingeschaltet)
- Amazon Fire TV Stick (beliebige Generation) im gleichen Netzwerk
- Internetverbindung (für Node.js-Installation und Wetter-Widget)

### Software installieren – Node.js

1. Öffne deinen Browser und gehe zu: **https://nodejs.org**
2. Klicke auf den großen grünen Button **„LTS"** (Long Term Support)
3. Die Datei `node-vXX.X.X-x64.msi` wird heruntergeladen
4. Öffne die heruntergeladene Datei und folge dem Installer:
   - Klicke **Next** → **Next** → **Next** → **Install**
   - Bestätige die UAC-Abfrage mit **Ja**
   - Klicke **Finish**
5. Überprüfe die Installation:
   - Drücke `Win + R`, tippe `cmd`, drücke Enter
   - Tippe `node --version` und drücke Enter
   - Es sollte etwas wie `v22.0.0` erscheinen ✓

---

## 2. Projekt einrichten

### Projektordner vorbereiten

1. Erstelle einen Ordner für das Projekt, z.B. `C:\Dashboard\firetv-dashboard`
2. Kopiere alle Projektdateien in diesen Ordner (oder klone das Git-Repository)
3. Öffne die Eingabeaufforderung (CMD) als Administrator:
   - Drücke `Win + R`
   - Tippe `cmd`
   - Drücke `Strg + Shift + Enter` (startet als Administrator)
4. Navigiere zum Projektordner:
   ```
   cd C:\Dashboard\firetv-dashboard
   ```
5. Installiere die Abhängigkeiten:
   ```
   npm install
   ```
   ✓ Du solltest sehen: `added 68 packages`

---

## 3. Server starten

### Erster Start (manuell testen)

1. Öffne CMD im Projektordner (wie in Schritt 2 beschrieben)
2. Starte den Server:
   ```
   node server.js
   ```
3. Der Server zeigt dir die Adressen an:
   ```
   📺 FireTV Dashboard Server gestartet
   ─────────────────────────────────────
     Display:  http://192.168.1.X:3000/display/
     Admin:    http://192.168.1.X:3000/admin/login.html
   ─────────────────────────────────────
   ```
4. Öffne einen Browser auf deinem PC und rufe die Display-URL auf → du solltest das Dashboard sehen
5. Rufe die Admin-URL auf → Login mit:
   - **Name:** `admin`
   - **PIN:** `1234`

   > ⚠️ **Wichtig:** Ändere den PIN nach dem ersten Login unter „Konto-Einstellungen"!

---

## 4. Eigenen Hostnamen einrichten (optional)

Statt der IP-Adresse `192.168.1.X` kannst du einen leichter merkbaren Namen verwenden, z.B. `dashboard.local`.

### Schritt 1 – IP-Adresse des Windows-PCs herausfinden

1. Drücke `Win + R`, tippe `cmd`, drücke Enter
2. Tippe `ipconfig` und drücke Enter
3. Suche den Eintrag **„IPv4-Adresse"** unter deiner Netzwerkkarte
   ```
   IPv4-Adresse . . . . . . . . . . : 192.168.1.232
   ```
4. Notiere diese Adresse – du brauchst sie gleich

> 💡 **Tipp:** Weise dem PC in deinem Router eine feste IP zu (DHCP-Reservierung), damit sich die Adresse nie ändert.

### Schritt 2 – Hosts-Datei auf dem Windows-PC bearbeiten

1. Drücke `Win`, suche nach **„Notepad"**
2. Rechtsklick auf Notepad → **„Als Administrator ausführen"**
3. Klicke in Notepad auf **Datei → Öffnen**
4. Navigiere zu: `C:\Windows\System32\drivers\etc\`
5. Ändere den Dateityp unten rechts von `Textdokumente` auf **„Alle Dateien"`**
6. Öffne die Datei **`hosts`**
7. Scrolle ans Ende der Datei und füge eine neue Zeile hinzu:
   ```
   192.168.1.232   dashboard.local
   ```
   *(Ersetze `192.168.1.232` mit deiner tatsächlichen IP)*
8. Klicke **Datei → Speichern**
9. Teste: Öffne Browser und rufe `http://dashboard.local:3000/display/` auf

### Schritt 3 – Hosts-Datei auf anderen PCs im Netzwerk

Wiederhole Schritt 2 auf **jedem weiteren PC**, von dem das Dashboard erreichbar sein soll. Auf dem Fire TV Stick ist das leider nicht möglich – dort bleibt die IP-Adresse nötig.

### Port aus der URL entfernen (port 80)

Wenn du `:3000` aus der URL entfernen möchtest:
1. Öffne `server.js` im Projektordner
2. Ändere `const PORT = process.env.PORT || 3000;` zu `const PORT = process.env.PORT || 80;`
3. Starte den Server als Administrator (Port 80 erfordert Admin-Rechte)
4. Die URL ist dann: `http://dashboard.local/display/`

---

## 5. Autostart auf Windows einrichten

Damit der Server automatisch startet wenn Windows hochfährt:

### Option A – Einfach: Startordner (empfohlen)

1. Erstelle im Projektordner eine neue Datei namens **`start.bat`** mit folgendem Inhalt:
   ```bat
   @echo off
   cd /d C:\Dashboard\firetv-dashboard
   node server.js
   ```
   *(Passe den Pfad an deinen Ordner an)*

2. Drücke `Win + R`, tippe `shell:startup`, drücke Enter
   → Der Windows-Startordner öffnet sich

3. Erstelle eine Verknüpfung zur `start.bat` in diesem Ordner:
   - Rechtsklick im Startordner → **Neu → Verknüpfung**
   - Ziel: `C:\Dashboard\firetv-dashboard\start.bat`
   - Name: `Dashboard Server`
   - Fertig stellen

4. Teste: Starte Windows neu → CMD-Fenster öffnet sich automatisch

> 💡 Falls das CMD-Fenster stören sollte (immer sichtbar), erstelle stattdessen eine `.vbs`-Datei im Startordner:
> ```vbs
> Set WshShell = CreateObject("WScript.Shell")
> WshShell.Run "cmd /c cd /d C:\Dashboard\firetv-dashboard && node server.js", 0, False
> ```

### Option B – Als Windows-Dienst (fortgeschritten)

```cmd
npm install -g pm2
pm2 start server.js --name dashboard
pm2 startup
pm2 save
```

---

## 6. Fire TV Stick einrichten

### Schritt 1 – Silk Browser öffnen

1. Drücke die **Home**-Taste auf der Fire TV Fernbedienung
2. Scrolle zu **„Apps"**
3. Öffne den **„Silk Browser"** (vorinstalliert)
   - Falls nicht vorhanden: Suche in der App-Bibliothek nach „Silk Browser"

### Schritt 2 – Dashboard-URL eingeben

1. Klicke in die Adressleiste oben im Silk Browser
2. Tippe die URL ein:
   ```
   http://192.168.1.232:3000/display/
   ```
   *(Ersetze die IP mit der Adresse deines Windows-PCs)*
3. Drücke Enter → Das Dashboard sollte erscheinen

### Schritt 3 – Lesezeichen erstellen

1. Klicke auf das **Menü-Symbol** (☰) im Silk Browser
2. Wähle **„Zu Favoriten hinzufügen"**
3. Gib als Namen `Dashboard` ein
4. Bestätige

### Schritt 4 – Vollbild aktivieren

1. Klicke im Menü auf **„Desktop-Ansicht"** (falls Seite verkleinert aussieht)
2. Drücke die **Zurück**-Taste → Das Dashboard füllt jetzt den Bildschirm

### Schritt 5 – Automatisches Öffnen beim Start

1. Gehe im Silk Browser zu **Einstellungen** (⚙️)
2. Wähle **„Startseite"**
3. Gib die Dashboard-URL ein
4. Jetzt öffnet sich das Dashboard automatisch wenn du den Silk Browser startest

### Fire TV nicht in Standby gehen lassen

1. Gehe auf dem Fire TV zu **Einstellungen → Display → Displayschoner**
2. Setze **„Displayschoner starten"** auf **„Nie"**
3. Gehe zu **Einstellungen → Display → Bildschirm abschalten**
4. Setze auf **„Nie"** oder den längsten verfügbaren Zeitraum

---

## 7. Admin-Bereich bedienen

### Login

1. Öffne in einem Browser (PC oder Tablet): `http://192.168.1.232:3000/admin/login.html`
2. Gib **Name** und **PIN** ein
3. Klicke **Anmelden**

### Sprache wechseln

- Klicke oben rechts auf den Button **„EN"** (wechselt zu Englisch)
- Klicke erneut für **„DE"** (zurück zu Deutsch)
- Die Spracheinstellung gilt auch für die Display-Seite

### Display öffnen

- Klicke oben in der Navigation auf **„▶ Anzeige öffnen"**
- Die Display-Seite öffnet sich in einem neuen Tab

### KPIs bearbeiten

1. Scrolle zum Bereich **„KPI-Kacheln"**
2. Fülle die Felder **Bezeichnung**, **Wert** und **Einheit** aus
3. Aktiviere/Deaktiviere einzelne Kacheln mit dem Schalter rechts
4. Klicke unten auf **„💾 Speichern"**
5. Das Display zeigt die neuen Werte nach spätestens 60 Sekunden

### Info-Tafel bearbeiten

1. Scrolle zu **„Info-Tafel"**
2. Bestehende Nachrichten bearbeiten: Text direkt in das Feld tippen
3. Neue Nachricht: Text eingeben → Priorität wählen → **„+ Hinzufügen"**
4. Nachricht löschen: Klicke auf 🗑
5. Klicke **„💾 Speichern"**

### Widgets Ein/Aus schalten

Im Bereich **„🎛️ Widgets"**:

| Widget | Funktion |
|--------|----------|
| **Uhr & Datum** | Große Uhr im Display ausblenden/einblenden |
| **Wetter** | Wetteranzeige (Stadt eingeben → Suchen → Speichern) |
| **Tier-Parade** | Tiere mit satis&fy Logo laufen über das Display |

### PIN ändern

1. Scrolle zu **„Konto-Einstellungen"**
2. Gib aktuellen PIN, neuen PIN und Bestätigung ein
3. Klicke **„PIN ändern"**

---

## 8. GitHub Pages (zweite Version)

### Repository erstellen

1. Gehe zu **https://github.com** und melde dich an
2. Klicke auf **„New repository"**
3. Gib einen Namen ein, z.B. `satisfy-dashboard`
4. Wähle **„Public"** (für GitHub Pages kostenlos nötig)
5. Klicke **„Create repository"**

### Code hochladen

1. Öffne CMD im Projektordner
2. Führe folgende Befehle aus:
   ```cmd
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/DEIN-USERNAME/satisfy-dashboard.git
   git push -u origin main
   ```

### GitHub Pages aktivieren

1. Gehe auf GitHub zu deinem Repository
2. Klicke auf **„Settings"** (Einstellungen)
3. Scrolle links zu **„Pages"**
4. Unter **„Source"** wähle **„GitHub Actions"**
5. Der erste Deploy startet automatisch (ca. 2 Minuten)
6. Die URL wird angezeigt: `https://DEIN-USERNAME.github.io/satisfy-dashboard/display/`

> ⚠️ **Hinweis:** In der GitHub Pages Version werden Daten im Browser-Speicher (localStorage) gespeichert. Änderungen im Admin sind nur im gleichen Browser sichtbar.

---

## 9. Fehlerbehebung

### Display ist schwarz / zeigt nichts an

**Ursache:** Server nicht erreichbar oder falsche URL
- Prüfe ob `node server.js` läuft (CMD-Fenster noch offen?)
- Prüfe die IP-Adresse: `ipconfig` in CMD
- Prüfe ob PC und Fire TV im gleichen WLAN/Netzwerk sind
- Teste die URL zuerst im PC-Browser

### Uhr zeigt 00:00:00 und bleibt stehen

**Ursache:** JavaScript konnte nicht geladen werden
- Öffne die Display-URL im PC-Browser
- Drücke `F12` → Tab **„Console"** → Fehlermeldungen ansehen
- Meist: falscher Dateipfad oder Server nicht gestartet

### Admin-Login funktioniert nicht

**Ursache:** Falscher PIN oder Konto gesperrt
- Standard-Login: Name `admin`, PIN `1234`
- Nach 5 Fehlversuchen: 15 Minuten warten
- Falls PIN vergessen: `data/content.json` löschen → Server neu starten → neues Standard-Passwort wird angelegt

### Wetter zeigt nichts an

**Ursache:** Stadt nicht gefunden oder kein Internet
- Im Admin: Wetter-Widget einschalten → Stadt neu suchen → Speichern
- Prüfe die Internetverbindung des Windows-PCs
- Versuche eine andere Schreibweise der Stadt (Englisch: z.B. `Munich` statt `München`)

### Fire TV lädt die Seite nicht

**Ursache:** Falscher WLAN oder Firewall blockiert Port 3000
- Stelle sicher, dass Fire TV und PC im gleichen WLAN sind
- Windows Firewall: `Win + R` → `wf.msc` → Eingehende Regeln → Neue Regel → Port 3000 erlauben
- Teste: Gib im Fire TV Silk Browser die IP-Adresse direkt ein

### Port 3000 in Windows Firewall öffnen (Schritt für Schritt)

1. Drücke `Win + R`, tippe `wf.msc`, drücke Enter
2. Klicke links auf **„Eingehende Regeln"**
3. Klicke rechts auf **„Neue Regel..."**
4. Wähle **„Port"** → Weiter
5. Wähle **„TCP"**, trage `3000` ein → Weiter
6. Wähle **„Verbindung zulassen"** → Weiter
7. Alle Checkboxen aktiviert lassen → Weiter
8. Name: `Dashboard Port 3000` → Fertig stellen

---

*satis&fy LLC – Dashboard v1.0*
