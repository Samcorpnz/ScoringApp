# Scoreboard System

Live sport scoring display. Reads Saturn/Vega serial console, broadcasts via cloud relay to any browser.

## Architecture

```
Saturn Console (RS422/serial)
      ↓
  bridge/   ← runs on the operator laptop at the venue
      ↓  Socket.io push (authenticated)
  relay/    ← cloud server (Railway / Render / fly.io)
      ↓  Socket.io broadcast
  frontend/ ← Next.js app (Vercel)
      ├── /display/basic     — clean scoreboard
      ├── /display/advanced  — with player roster
      ├── /display/overlay   — transparent (OBS/vMix)
      └── /control           — operator panel
```

## Quick Start (local development)

### 1. Relay
```bash
cd relay
npm install
cp .env.example .env   # set secrets
npm run dev            # starts on :4000
```

### 2. Bridge (venue laptop)
```bash
cd bridge
npm install
cp .env.example .env
# edit .env: set RELAY_URL, BRIDGE_SECRET, SERIAL_PORT
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
# .env.local already points to localhost:4000
npm run dev            # starts on :3000
```

Then open http://localhost:3000

---

## Production Deployment

### Relay → Railway (recommended)
1. Create new project on railway.app
2. Deploy the `relay/` folder
3. Set environment variables: `BRIDGE_SECRET`, `CONTROL_SECRET`
4. Note the public URL (e.g. `https://scoreboard-relay.railway.app`)

### Frontend → Vercel
1. Push to GitHub
2. Import the `frontend/` folder in Vercel
3. Set env vars: `NEXT_PUBLIC_RELAY_URL`, `NEXT_PUBLIC_CONTROL_SECRET`

### Bridge → venue laptop
1. `npm run build` then `npm start` (or just `npm run dev`)
2. Set `RELAY_URL` in `.env` to the Railway URL
3. Set `SERIAL_PORT` to your COM port (Windows: `COM3`, Mac/Linux: `/dev/tty.usbserial-XXXX`)

---

## Serial Protocol

**Saturn/Vega (Swiss Timing)** — spec 0100.073.02 v2.0
- 9600 baud, 8N1, RS422
- Messages framed with STX/ETX + XOR checksum
- Cycle: D (match state) + F1/F2 (player shirts) + F3/F4 (points) + T (time/config) + N (names)

**Score Pilot** — add a new parser in `bridge/src/protocol/` and register it in `bridge/src/index.ts`

---

## Display URLs

| URL | Use |
|-----|-----|
| `/display/basic` | Venue screens, projectors |
| `/display/advanced` | Broadcast monitor, full stats |
| `/display/overlay` | OBS Browser Source (1920×120) |
| `/control` | Operator — manual overrides |

## OBS Setup (overlay)
1. Add a **Browser Source** in OBS
2. URL: `https://your-frontend.vercel.app/display/overlay`
3. Width: 1920, Height: 120
4. Check "Shutdown source when not visible"
5. The background is transparent — no chroma key needed
