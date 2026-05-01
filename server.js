/**
 * HomeDisplay Server
 * Handles WebSocket real-time sync between Admin and Display clients
 * Deploy to Railway / Render / Fly.io for free hosting
 */

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const fs        = require('fs');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;

// ── Persistence ──
const DATA_FILE = path.join(__dirname, 'data.json');
let db = { channels: {} };

function loadDb() {
  try {
    if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch(e) {}
}

function saveDb() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch(e) {}
}

loadDb();

// ── In-memory socket registry ──
// clients[key] = Set<ws>
const clients = {};
const meta    = new WeakMap(); // ws → { key, role }

function roomSend(key, msg, filter = null) {
  if (!clients[key]) return;
  const raw = JSON.stringify(msg);
  clients[key].forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (filter && meta.get(ws)?.role !== filter) return;
    ws.send(raw);
  });
}

function countRole(key, role) {
  if (!clients[key]) return 0;
  let n = 0;
  clients[key].forEach(ws => { if (meta.get(ws)?.role === role) n++; });
  return n;
}

// ── WebSocket ──
wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, key } = msg;
    if (!key) return;

    switch (type) {

      case 'join': {
        const role = msg.role || 'display';
        meta.set(ws, { key, role });
        if (!clients[key]) clients[key] = new Set();
        clients[key].add(ws);

        // Send current channel state immediately
        if (db.channels[key]) {
          ws.send(JSON.stringify({ type: 'state', ...db.channels[key] }));
        } else if (role === 'admin') {
          db.channels[key] = { slides: [], settings: defaultSettings(), ts: Date.now() };
          saveDb();
          ws.send(JSON.stringify({ type: 'state', ...db.channels[key] }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Channel not found. Create it in the admin panel first.' }));
          return;
        }

        // Tell admin how many displays are live
        roomSend(key, { type: 'presence', displays: countRole(key, 'display') }, 'admin');
        break;
      }

      case 'push': {
        const r = meta.get(ws);
        if (r?.role !== 'admin') return;
        db.channels[r.key] = { slides: msg.slides || [], settings: msg.settings || {}, ts: Date.now() };
        saveDb();
        roomSend(r.key, { type: 'load', slides: db.channels[r.key].slides, settings: db.channels[r.key].settings }, 'display');
        break;
      }

      case 'cmd': {
        const r = meta.get(ws);
        if (r?.role !== 'admin') return;
        roomSend(r.key, { type: 'cmd', cmd: msg.cmd }, 'display');
        break;
      }

      case 'ping': {
        const r = meta.get(ws);
        if (!r) return;
        roomSend(r.key, { type: 'presence', displays: countRole(r.key, 'display'), slideIdx: msg.slideIdx }, 'admin');
        break;
      }
    }
  });

  ws.on('close', () => {
    const r = meta.get(ws);
    if (!r) return;
    clients[r.key]?.delete(ws);
    roomSend(r.key, { type: 'presence', displays: countRole(r.key, 'display') }, 'admin');
    meta.delete(ws);
  });

  ws.on('error', () => {});
});

// ── REST ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check (Railway needs this)
app.get('/health', (_, res) => res.json({ ok: true }));

// Create channel
app.post('/api/channel', (_, res) => {
  const key = genKey();
  db.channels[key] = { slides: [], settings: defaultSettings(), ts: Date.now() };
  saveDb();
  res.json({ key });
});

// Check channel
app.get('/api/channel/:key', (req, res) => {
  const key = req.params.key.toUpperCase();
  res.json({ exists: !!db.channels[key] });
});

// Get full channel data (for mobile app REST fallback)
app.get('/api/channel/:key/data', (req, res) => {
  const key = req.params.key.toUpperCase();
  if (!db.channels[key]) return res.status(404).json({ error: 'Not found' });
  res.json(db.channels[key]);
});

function genKey() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let k;
  do { k = Array.from({length:6}, () => c[Math.floor(Math.random()*c.length)]).join(''); }
  while (db.channels[k]);
  return k;
}

function defaultSettings() {
  return { loop: true, clock: true, date: true, ticker: false, tickerMsg: '', transition: 'fade' };
}

// ── Admin panel redirect ──
app.get('/', (_, res) => res.redirect('/admin.html'));
app.get('/admin', (_, res) => res.redirect('/admin.html'));
app.get('/display', (_, res) => res.redirect('/display.html'));

server.listen(PORT, () => {
  console.log(`\n  HomeDisplay Server running on port ${PORT}\n`);
});
