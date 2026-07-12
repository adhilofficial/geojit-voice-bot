# Geojit Voice Bot Dashboard

React and Vite frontend for customer management, live Exotel calls and mock campaign testing.

## Commands

```powershell
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

Create `.env` from `.env.example` and set the deployed backend URL:

```text
VITE_API_BASE_URL=https://geojit-voice-bot-api.onrender.com/api
```

The customer-table **Start Call** action uses Exotel. The campaign screen currently uses the mock IVR workflow for controlled testing.
