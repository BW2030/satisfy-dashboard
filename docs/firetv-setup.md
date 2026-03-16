# Fire TV Stick – Kiosk-Setup

## 1. Developer Mode aktivieren
- Einstellungen → Mein Fire TV → Info
- 7x auf "Seriennummer" klicken
- "Developer-Optionen" erscheint im Menü

## 2. ADB-Debugging aktivieren
- Developer-Optionen → ADB-Debugging: Ein
- Developer-Optionen → Apps von unbekannten Quellen: Ein
- IP-Adresse notieren: Einstellungen → Mein Fire TV → Info → Netzwerk

## 3. Browser-Kiosk einrichten
- Amazon Silk Browser öffnen
- Dashboard-URL aufrufen: https://satisfy-dashboard.onrender.com/display/
- Adressleiste → Lesezeichen speichern
- Einstellungen → Silk → Als Startseite setzen

## 4. Bildschirmschoner deaktivieren
- Einstellungen → Anzeige & Töne → Bildschirmschoner → Aus

## 5. Auto-Start via ADB (optional, von PC)
- adb connect [Fire-TV-IP]:5555
- adb shell pm grant com.amazon.cloud9 android.permission.SYSTEM_ALERT_WINDOW
- adb shell am start -a android.intent.action.VIEW -d "https://satisfy-dashboard.onrender.com/display/"
