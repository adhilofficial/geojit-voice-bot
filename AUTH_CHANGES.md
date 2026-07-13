# Authentication Changes

- Added administrator email/password login.
- Added bcrypt password verification.
- Added signed HS256 JWT access tokens.
- Added an eight-hour default session expiry.
- Added login attempt throttling: five failed attempts per IP in 15 minutes.
- Protected lead, call, campaign, export, callback and delete APIs.
- Kept health checks and Exotel webhooks public.
- Added a secure login screen and logout button.
- Added automatic logout on token expiry or any authenticated API `401` response.
- Stored access tokens in browser `sessionStorage`, not local storage.
- Added a password-hash helper script.
- Added safe environment-variable examples.
