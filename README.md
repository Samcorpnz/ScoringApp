# ScoreHub System

Live sport scoring display. Reads Saturn/Vega serial console, broadcasts via cloud relay to any browser.

## Architecture

```
Saturn Console (RS422/serial)
      ↓
  bridge/   ← runs on the operator laptop at the venue
      ↓  Socket.io push (authenticated)
  relay/    ← cloud server (Fly.io, multi-region)
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

### Relay → Fly.io (recommended)
1. `fly apps create <name>` (or reuse the existing `scorehub-relay` app)
2. Deploy from repo root: `fly deploy` (uses `fly.toml`, builds `relay/Dockerfile`)
3. Set secrets: `fly secrets set BRIDGE_SECRET=... CONTROL_SECRET=... ALLOWED_ORIGINS=...` (`ALLOWED_ORIGINS` is the frontend's deployed origin — production is `https://app.scorehub.co.nz`; `scorehub.co.nz` apex is reserved for the marketing site, not this app)
4. Scale into additional regions for failover: `fly scale count 2 --region iad`
5. Note the public anycast URL (e.g. `https://scorehub-relay.fly.dev`)

### Frontend → Vercel
1. Push to GitHub
2. Import the `frontend/` folder in Vercel
3. Set env vars: `NEXT_PUBLIC_RELAY_URL`, `NEXT_PUBLIC_CONTROL_SECRET`

### Bridge → venue laptop
1. `npm run build` then `npm start` (or just `npm run dev`)
2. Set `RELAY_URL` in `.env` to the Fly.io URL
3. Set `SERIAL_PORT` to your COM port (Windows: `COM3`, Mac/Linux: `/dev/tty.usbserial-XXXX`)

### Human-gated production deploys (SA-12)
`.github/workflows/deploy.yml` runs the full test suite, then deploys relay (Fly.io) and frontend (Vercel) — but only after a manual approval, via a `production` GitHub Environment with required reviewers. This is the only deploy path that should be live; Fly.io's and Vercel's own GitHub-push auto-deploy must be turned off in their dashboards, or every push deploys immediately regardless of this gate. One-time setup (repo admin, in GitHub/Fly.io/Vercel dashboards — not done as part of this change):
1. Repo Settings → Environments → create `production`, add required reviewers.
2. Add repo secrets: `FLY_API_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
3. Fly.io only deploys via this CI workflow — there's no separate "deploy on push" dashboard toggle to disable.
4. In Vercel's project settings, disable the Git integration's auto-deploy (or set the production branch to something other than `main` so pushes don't auto-trigger).

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
