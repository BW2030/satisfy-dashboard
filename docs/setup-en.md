# satis&fy Dashboard – Setup Guide (English)

---

## Quick Access – All Links

> **Current IP of the dashboard server: `192.168.1.232`**
>
> ⚠️ This IP address can change (see [Setting a Static IP Address](#setting-a-static-ip-address)).

| Page | Link |
|------|------|
| 📺 **Display** (Fire TV opens this URL) | http://192.168.1.232:3000/display/ |
| 🔐 **Admin Login** | http://192.168.1.232:3000/admin/login.html |
| 🎛️ **Admin Dashboard** (after login) | http://192.168.1.232:3000/admin/index.html |
| 🏠 **Home** (redirects to display) | http://192.168.1.232:3000/ |

**Default login:** Name `admin` · PIN `1234`
*(Please change this after your first login under "Account Settings"!)*

---

## ⚠️ Does the IP address change?

**Yes** – by default your router assigns a new IP via DHCP each time the PC restarts or reconnects to the network. This means the links above could stop working after a reboot.

### Setting a Static IP Address

There are two ways to permanently fix the IP:

#### Option A – Static IP in the router (recommended)

1. Open your router's admin page in your browser (usually `http://192.168.1.1` or `http://fritz.box`)
2. Look for **DHCP** → **Address Reservation** (on FritzBox: *Home Network → Network → IP Addresses*)
3. Select the Windows PC from the list of connected devices
4. Assign it a **fixed IP**, e.g. `192.168.1.232`
5. Save and restart the router
6. From now on the PC always has the same IP – all links stay valid ✓

#### Option B – Static IP directly on the Windows PC

1. Press `Win + R`, type `ncpa.cpl`, press Enter
2. Right-click your network connection → **Properties**
3. Double-click **"Internet Protocol Version 4 (TCP/IPv4)"**
4. Select **"Use the following IP address"**
5. Fill in:
   - IP address: `192.168.1.232`
   - Subnet mask: `255.255.255.0`
   - Default gateway: `192.168.1.1` *(your router's IP)*
   - DNS server: `8.8.8.8`
6. Click **OK** → **OK**

> Once a static IP is set, all links are permanently valid and never need to be updated.

---

## Table of Contents

0. [Online Hosting with Render.com (recommended)](#0-online-hosting-with-rendercom-recommended)
1. [Requirements](#1-requirements)
2. [Project Setup](#2-project-setup)
3. [Starting the Server](#3-starting-the-server)
4. [Custom Hostname (optional)](#4-custom-hostname-optional)
5. [Windows Autostart](#5-windows-autostart)
6. [Fire TV Stick Setup](#6-fire-tv-stick-setup)
7. [Using the Admin Panel](#7-using-the-admin-panel)
8. [GitHub Pages (second version)](#8-github-pages-second-version)
9. [Troubleshooting](#9-troubleshooting)

---

## 0. Online Hosting with Render.com (recommended)

No Windows PC needed – the dashboard runs entirely in the cloud. The Fire TV Stick simply opens the Render URL.

### Step 1 – Create a GitHub repository

1. Go to **https://github.com** and create a free account (if you don't have one)
2. Click **"+"** → **"New repository"** in the top right
3. Name: `satisfy-dashboard` → **"Public"** → **"Create repository"**
4. Open a terminal and run:
   ```bash
   cd /Users/admin/firetv-dashboard
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/satisfy-dashboard.git
   git push -u origin main
   ```
   *(Replace `YOUR-USERNAME` with your GitHub username)*

### Step 2 – Create a Render.com account

1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Select **"Continue with GitHub"** → Authorize Render

### Step 3 – Create a new Web Service

1. In the Render dashboard click **"New +"** → **"Web Service"**
2. Select **"Build and deploy from a Git repository"** → **"Next"**
3. Connect your GitHub repository `satisfy-dashboard`
4. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Name** | `satisfy-dashboard` |
   | **Region** | `Oregon (US West)` |
   | **Branch** | `main` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | `Free` |

5. Click **"Create Web Service"**
6. Render builds the project automatically (~2 minutes)
7. Your URL appears at the top: `https://satisfy-dashboard.onrender.com`

### Step 4 – Open the dashboard

Your links are now:

| Page | URL |
|------|-----|
| 📺 **Display** | `https://satisfy-dashboard.onrender.com/display/` |
| 🔐 **Admin Login** | `https://satisfy-dashboard.onrender.com/admin/login.html` |

**Default login:** Name `admin` · PIN `1234`

### Step 5 – Set up Auto-Ping (prevents sleeping)

Render goes to sleep after 15 minutes without any requests. Here's how to prevent that for free:

1. Go to **https://cron-job.org** and create a free account
2. Click **"CREATE CRONJOB"**
3. Fill in:
   - **Title:** `Dashboard Keep-Alive`
   - **URL:** `https://satisfy-dashboard.onrender.com/ping`
   - **Schedule:** Every **10 minutes** (click "Every 10 minutes")
4. Click **"CREATE"**
5. ✅ The dashboard now runs 24/7 without interruption

### Step 6 – Set up Fire TV Stick

1. Open **Silk Browser** on the Fire TV
2. Enter: `https://satisfy-dashboard.onrender.com/display/`
3. Save as bookmark → done!

> **Note on data:** If Render restarts the server (e.g. after an update), changes you made in the admin panel will be reset. To save your default data permanently: edit the values in `data/content.json` → push to GitHub → Render automatically redeploys.

---

## 1. Requirements

### What you need
- A Windows PC or server on the local network (always powered on)
- Amazon Fire TV Stick (any generation) on the same network
- Internet connection (for Node.js installation and the weather widget)

### Install software – Node.js

1. Open your browser and go to: **https://nodejs.org**
2. Click the large green **"LTS"** button (Long Term Support)
3. The file `node-vXX.X.X-x64.msi` will download
4. Open the downloaded file and follow the installer:
   - Click **Next** → **Next** → **Next** → **Install**
   - Confirm the UAC prompt with **Yes**
   - Click **Finish**
5. Verify the installation:
   - Press `Win + R`, type `cmd`, press Enter
   - Type `node --version` and press Enter
   - You should see something like `v22.0.0` ✓

---

## 2. Project Setup

### Prepare the project folder

1. Create a folder for the project, e.g. `C:\Dashboard\firetv-dashboard`
2. Copy all project files into this folder (or clone the Git repository)
3. Open Command Prompt (CMD) as Administrator:
   - Press `Win + R`
   - Type `cmd`
   - Press `Ctrl + Shift + Enter` (runs as Administrator)
4. Navigate to the project folder:
   ```
   cd C:\Dashboard\firetv-dashboard
   ```
5. Install the dependencies:
   ```
   npm install
   ```
   ✓ You should see: `added 68 packages`

---

## 3. Starting the Server

### First start (manual test)

1. Open CMD in the project folder (as described in step 2)
2. Start the server:
   ```
   node server.js
   ```
3. The server will display the addresses:
   ```
   📺 FireTV Dashboard Server started
   ─────────────────────────────────────
     Display:  http://192.168.1.X:3000/display/
     Admin:    http://192.168.1.X:3000/admin/login.html
   ─────────────────────────────────────
   ```
4. Open a browser on your PC and visit the Display URL → you should see the dashboard
5. Visit the Admin URL → log in with:
   - **Name:** `admin`
   - **PIN:** `1234`

   > ⚠️ **Important:** Change your PIN after the first login under "Account Settings"!

---

## 4. Custom Hostname (optional)

Instead of the IP address `192.168.1.X`, you can use an easier-to-remember name like `dashboard.local`.

### Step 1 – Find the Windows PC's IP address

1. Press `Win + R`, type `cmd`, press Enter
2. Type `ipconfig` and press Enter
3. Look for **"IPv4 Address"** under your network adapter:
   ```
   IPv4 Address . . . . . . . . . . : 192.168.1.232
   ```
4. Note this address – you'll need it shortly

> 💡 **Tip:** Assign your PC a static IP in your router (DHCP reservation) so the address never changes.

### Step 2 – Edit the hosts file on the Windows PC

1. Press `Win`, search for **"Notepad"**
2. Right-click Notepad → **"Run as administrator"**
3. In Notepad, click **File → Open**
4. Navigate to: `C:\Windows\System32\drivers\etc\`
5. Change the file type filter (bottom right) from `Text Documents` to **"All Files"**
6. Open the file **`hosts`**
7. Scroll to the bottom and add a new line:
   ```
   192.168.1.232   dashboard.local
   ```
   *(Replace `192.168.1.232` with your actual IP)*
8. Click **File → Save**
9. Test: Open your browser and visit `http://dashboard.local:3000/display/`

### Step 3 – Hosts file on other PCs in the network

Repeat Step 2 on **every other PC** that should be able to access the dashboard. Unfortunately this is not possible on the Fire TV Stick – the IP address remains necessary there.

### Remove the port number from the URL (use port 80)

If you want to remove `:3000` from the URL:
1. Open `server.js` in the project folder
2. Change `const PORT = process.env.PORT || 3000;` to `const PORT = process.env.PORT || 80;`
3. Start the server as Administrator (port 80 requires admin rights)
4. The URL will then be: `http://dashboard.local/display/`

---

## 5. Windows Autostart

So the server starts automatically when Windows boots:

### Option A – Simple: Startup Folder (recommended)

1. Create a new file called **`start.bat`** in the project folder with the following content:
   ```bat
   @echo off
   cd /d C:\Dashboard\firetv-dashboard
   node server.js
   ```
   *(Adjust the path to your folder)*

2. Press `Win + R`, type `shell:startup`, press Enter
   → The Windows startup folder opens

3. Create a shortcut to `start.bat` in this folder:
   - Right-click in the startup folder → **New → Shortcut**
   - Target: `C:\Dashboard\firetv-dashboard\start.bat`
   - Name: `Dashboard Server`
   - Click Finish

4. Test: Restart Windows → a CMD window opens automatically

> 💡 If the CMD window is distracting (always visible), create a `.vbs` file in the startup folder instead:
> ```vbs
> Set WshShell = CreateObject("WScript.Shell")
> WshShell.Run "cmd /c cd /d C:\Dashboard\firetv-dashboard && node server.js", 0, False
> ```

### Option B – As a Windows Service (advanced)

```cmd
npm install -g pm2
pm2 start server.js --name dashboard
pm2 startup
pm2 save
```

---

## 6. Fire TV Stick Setup

### Step 1 – Open Silk Browser

1. Press the **Home** button on the Fire TV remote
2. Scroll to **"Apps"**
3. Open **"Silk Browser"** (pre-installed)
   - If not found: Search the app library for "Silk Browser"

### Step 2 – Enter the dashboard URL

1. Click the address bar at the top of the Silk Browser
2. Type the URL:
   ```
   http://192.168.1.232:3000/display/
   ```
   *(Replace the IP with your Windows PC's address)*
3. Press Enter → The dashboard should appear

### Step 3 – Create a bookmark

1. Click the **menu icon** (☰) in Silk Browser
2. Select **"Add to Favorites"**
3. Enter the name `Dashboard`
4. Confirm

### Step 4 – Enable fullscreen

1. Click **"Desktop View"** in the menu (if the page looks zoomed out)
2. Press the **Back** button → The dashboard now fills the entire screen

### Step 5 – Open automatically on startup

1. Go to **Settings** (⚙️) in Silk Browser
2. Select **"Homepage"**
3. Enter the dashboard URL
4. Now the dashboard opens automatically whenever you launch Silk Browser

### Prevent Fire TV from going to standby

1. On the Fire TV go to **Settings → Display → Screen Saver**
2. Set **"Start Screen Saver"** to **"Never"**
3. Go to **Settings → Display → Turn Off Display**
4. Set to **"Never"** or the longest available time

---

## 7. Using the Admin Panel

### Login

1. Open in a browser (PC or tablet): `http://192.168.1.232:3000/admin/login.html`
2. Enter your **Name** and **PIN**
3. Click **Sign In**

### Switch Language

- Click the **"EN"** button in the top right corner (switches to English)
- Click again for **"DE"** (back to German)
- The language setting also applies to the display page

### Open the Display

- Click **"▶ Open Display"** in the top navigation bar
- The display page opens in a new tab

### Edit KPIs

1. Scroll to the **"KPI Tiles"** section
2. Fill in the **Label**, **Value**, and **Unit** fields
3. Enable/disable individual tiles with the toggle on the right
4. Click **"💾 Save"** at the bottom
5. The display shows the new values within 60 seconds

### Edit Info Board

1. Scroll to **"Info Board"**
2. Edit existing messages: type directly into the text field
3. New message: enter text → choose priority → click **"+ Add"**
4. Delete a message: click 🗑
5. Click **"💾 Save"**

### Toggle Widgets On/Off

In the **"🎛️ Widgets"** section:

| Widget | Function |
|--------|----------|
| **Clock & Date** | Show/hide the large clock on the display |
| **Weather** | Weather display (enter city → Search → Save) |
| **Animal Parade** | Animals with satis&fy logo run across the display |

### Change PIN

1. Scroll to **"Account Settings"**
2. Enter current PIN, new PIN, and confirmation
3. Click **"Change PIN"**

---

## 8. GitHub Pages (second version)

### Create a repository

1. Go to **https://github.com** and sign in
2. Click **"New repository"**
3. Enter a name, e.g. `satisfy-dashboard`
4. Select **"Public"** (required for free GitHub Pages)
5. Click **"Create repository"**

### Upload the code

1. Open CMD in the project folder
2. Run the following commands:
   ```cmd
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/satisfy-dashboard.git
   git push -u origin main
   ```

### Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"**
3. Scroll to **"Pages"** in the left sidebar
4. Under **"Source"** select **"GitHub Actions"**
5. The first deployment starts automatically (approx. 2 minutes)
6. Your URL will be: `https://YOUR-USERNAME.github.io/satisfy-dashboard/display/`

> ⚠️ **Note:** In the GitHub Pages version, data is stored in browser storage (localStorage). Admin changes are only visible in the same browser.

---

## 9. Troubleshooting

### Display is black / shows nothing

**Cause:** Server not running or wrong URL
- Check if `node server.js` is running (CMD window still open?)
- Check your IP address: type `ipconfig` in CMD
- Check that the PC and Fire TV are on the same Wi-Fi network
- Test the URL in your PC's browser first

### Clock shows 00:00:00 and stays frozen

**Cause:** JavaScript failed to load
- Open the display URL in your PC's browser
- Press `F12` → **"Console"** tab → look for error messages
- Most likely: wrong file path or server not started

### Admin login doesn't work

**Cause:** Wrong PIN or account locked
- Default login: Name `admin`, PIN `1234`
- After 5 failed attempts: wait 15 minutes
- If PIN is forgotten: delete `data/content.json` → restart server → default credentials are recreated

### Weather shows nothing

**Cause:** City not found or no internet connection
- In Admin: enable Weather widget → search for city again → Save
- Check the internet connection on the Windows PC
- Try an alternative city spelling (e.g. `Munich` instead of `München`)

### Fire TV doesn't load the page

**Cause:** Wrong Wi-Fi or firewall blocking port 3000
- Make sure Fire TV and PC are on the same Wi-Fi
- Windows Firewall: `Win + R` → `wf.msc` → Inbound Rules → New Rule → allow port 3000
- Test: Enter the IP address directly in the Fire TV Silk Browser

### Open port 3000 in Windows Firewall (step by step)

1. Press `Win + R`, type `wf.msc`, press Enter
2. Click **"Inbound Rules"** on the left
3. Click **"New Rule..."** on the right
4. Select **"Port"** → Next
5. Select **"TCP"**, enter `3000` → Next
6. Select **"Allow the connection"** → Next
7. Leave all checkboxes checked → Next
8. Name: `Dashboard Port 3000` → Finish

---

*satis&fy LLC – Dashboard v1.0*
