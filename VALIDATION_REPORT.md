# Validation Report — Admin Authentication Update

## Completed checks

- All backend JavaScript files passed `node --check`.
- Backend authentication smoke test passed.
- Public health endpoint returned HTTP 200.
- Unauthenticated business API request returned HTTP 401.
- Invalid admin login returned HTTP 401.
- Valid admin login returned a signed JWT.
- Authenticated `/api/auth/me` returned the admin identity.
- Exotel status webhook remained publicly reachable.
- Dashboard lint completed with 0 warnings and 0 errors.
- Dashboard Vite production build completed successfully.
- Backend production dependency audit found 0 vulnerabilities.
- Dashboard production dependency audit found 0 vulnerabilities.

## Security behavior validated

- Passwords are compared against a bcrypt hash.
- JWTs are signed with HS256 and verify issuer, audience and subject.
- Lead, call, campaign, callback, export and delete APIs require a bearer token.
- Health, login and Exotel webhook endpoints remain public.
- Failed login attempts are limited to five per IP within 15 minutes.
- Access tokens are stored in browser `sessionStorage`.
- The dashboard logs out automatically when a token expires or an authenticated request returns HTTP 401.
- Authentication responses use no-store cache headers.

## Not executed in the validation environment

Real MongoDB, Exotel, Render and Vercel requests were not executed because private credentials were intentionally excluded from the uploaded source.
