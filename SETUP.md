# Home Display — Complete Setup Guide

Everything in 3 steps: Deploy server → Build APK → Install on Android

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Deploy the Server (Free, 5 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using Railway (free, no credit card needed):

1. Go to https://railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Upload the /server folder to a new GitHub repo, then connect it
   (Or use Railway CLI: https://docs.railway.app/develop/cli)
4. Railway auto-detects Node.js and runs `npm start`
5. Go to Settings → Networking → Generate Domain
6. Your server URL will be something like:
   https://home-display-abc123.railway.app

Alternative — Render.com (also free):
1. https://render.com → New → Web Service
2. Connect your GitHub repo (server folder)
3. Build command: npm install
4. Start command: node server.js
5. Free tier URL: https://home-display.onrender.com

Note down your server URL — you'll need it for the app.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Build the Android APK (Free, 10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Requirements:
- Node.js 18+ (https://nodejs.org)
- Free Expo account (https://expo.dev)

Instructions:

1. Open the /mobile folder:
   cd mobile

2. Edit App.js line 12 — replace with your server URL:
   const DEFAULT_SERVER = 'wss://YOUR-APP.railway.app';
   (change https:// to wss:// and http:// to ws://)

3. Install dependencies:
   npm install

4. Install EAS CLI and log in:
   npm install -g eas-cli
   eas login

5. Configure the project (first time only):
   eas build:configure
   (This sets your projectId in app.json automatically)

6. Build the APK:
   npm run build:apk

7. Wait ~10 minutes. Expo builds it in the cloud (free).
   When done, you get a download link for the .apk file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Install APK on Android
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Download the .apk from the Expo build link
2. Transfer to your Android device (email, USB, Google Drive)
3. On Android: Settings → Security → Allow Unknown Sources (or
   "Install unknown apps" for the Files app)
4. Open the .apk file and install
5. Launch "Home Display" from your app drawer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Connect Everything
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Admin panel (on any browser, phone or laptop):
  https://YOUR-APP.railway.app/admin.html

1. Open admin panel — note the 6-letter Channel Key shown
2. Open Home Display app on your Android TV/tablet
3. Enter your server URL and channel key → Connect & Play
4. Add slides in the admin → Push to Display
5. The Android screen updates instantly via WebSocket!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• "Cannot reach server" → Make sure URL uses wss:// (not https://)
• APK build fails → Run: eas build:configure (first time setup)
• Display doesn't update → Press "Push to Display" in admin
• Railway sleeps after inactivity (free tier) → upgrade to $5/mo
  Hobby plan or use Render with UptimeRobot to keep it awake:
  https://uptimerobot.com (free pings every 5 min)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

homedisplay/
├── server/               ← Deploy this to Railway
│   ├── server.js         ← WebSocket + REST server
│   ├── package.json
│   └── public/
│       └── admin.html    ← Web admin panel
└── mobile/               ← Build this into APK
    ├── App.js            ← Main React Native app
    ├── app.json          ← Expo config
    ├── eas.json          ← Build config
    └── package.json
