# Geojit Admin Authentication Patch

Copy this patch over the project root. It adds administrator login, JWT-protected business APIs, automatic session expiry and a logout control.

After copying:

1. Run `npm install` inside `backend` and `dashboard`.
2. Follow `AUTH_SETUP.md`.
3. Add the four authentication environment variables in Render.
4. Deploy both Render and Vercel.
