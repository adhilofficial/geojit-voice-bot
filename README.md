# Geojit Voice Bot

A simple outbound IVR voice bot with a React dashboard, Node/Express API, MongoDB Atlas storage, mock IVR testing, and Exotel live calls.

## Project structure

```text
geojit-voice-bot/
├── backend/                 Node.js, Express, MongoDB and Exotel
├── dashboard/               React and Vite dashboard
├── validate-project.ps1     One-command Windows validation
└── VALIDATION_REPORT.md     Checks completed for this package
```

## Local setup

### Backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Update `backend/.env` with MongoDB and Exotel credentials. Never commit `.env`.

### Dashboard

```powershell
cd dashboard
Copy-Item .env.example .env
npm install
npm run dev
```

The local dashboard opens at `http://localhost:5173` and uses `http://localhost:5000/api` by default.

## Validate the full project

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\validate-project.ps1
```

## Deployment values

### Render backend

Use the `backend` directory as the service root and set:

```text
Build Command: npm install
Start Command: npm start
```

Add all values from `backend/.env.example` in Render Environment. For this Exotel account, the subdomain is `api.exotel.com`.

### Vercel dashboard

```text
Root Directory: dashboard
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Set:

```text
VITE_API_BASE_URL=https://geojit-voice-bot-api.onrender.com/api
```

The included `dashboard/vercel.json` prevents stale HTML from continuing to reference an older hashed JavaScript asset.

## Current call behavior

- The customer-table **Start Call** button uses the live Exotel endpoint.
- Live call status refreshes automatically every five seconds while a call is active.
- The campaign workflow remains the safe mock IVR queue until real sequential campaign calling is intentionally enabled.
- Exotel status callbacks update the customer status, provider Call SID, duration, recording URL and error state.
