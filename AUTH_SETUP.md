# Admin Authentication Setup

The dashboard and business APIs are protected by a time-limited administrator JWT. The health endpoint, login endpoint and Exotel webhooks remain public.

## 1. Install backend packages

```powershell
cd backend
npm install
```

## 2. Create the admin password hash

```powershell
npm run hash-password
```

Enter a password with at least 10 characters. Copy only the generated bcrypt hash into Render as `ADMIN_PASSWORD_HASH`.

## 3. Generate the JWT secret

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$jwtSecret = [Convert]::ToBase64String($bytes)
$rng.Dispose()
$jwtSecret
```

## 4. Add Render environment variables

```env
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD_HASH=the-generated-bcrypt-hash
JWT_SECRET=the-generated-random-secret
JWT_EXPIRES_IN=8h
```

Do not add quotation marks. Save the variables and redeploy the Render backend.

## 5. Deploy the dashboard

The frontend needs no password or JWT secret. Keep only:

```env
VITE_API_BASE_URL=https://geojit-voice-bot-api.onrender.com/api
VITE_CAMPAIGN_MAX_CUSTOMERS=3
```

## Protected and public routes

Public:

- `GET /api/health`
- `POST /api/auth/login`
- `GET|POST /api/webhooks/exotel/status`
- `GET|POST /api/webhooks/exotel/digit`

Protected:

- `/api/leads/*`
- `/api/calls/*`
- `/api/live-calls/*`
- `GET /api/auth/me`

The token is stored in `sessionStorage`, so closing the browser tab/session removes the local login. The token also expires according to `JWT_EXPIRES_IN`.
