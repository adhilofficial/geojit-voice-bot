# Updated Files and Fixes

## Dashboard

- Connected each customer row's **Start Call** button to the real Exotel endpoint.
- Added the missing `startLiveCall()` API function.
- Added five-second silent polling while a live call is active.
- Kept campaign calls in mock mode to avoid accidental trial-credit usage.
- Added API request timeouts and clearer non-JSON error handling.
- Replaced the default Vite global CSS that constrained the dashboard width and introduced unwanted dark-mode styling.
- Added production metadata and a Vercel configuration that prevents stale `index.html` caching.
- Removed old backup files and unused starter assets.

## Backend

- Preserved the successful Exotel call even when the immediate response has no readable Call SID.
- Added robust Exotel JSON/XML response handling and request timeout protection.
- Removed the unsupported `StatusCallbackEvents` parameter.
- Added lead ID tracking in the callback URL and optional webhook-secret validation.
- Added GET and POST support for Exotel status callbacks.
- Expanded callback parsing for common Call SID, status and duration field names.
- Improved MongoDB startup validation and graceful server shutdown.
- Improved CORS normalization, request-size limits and production logging.
- Improved CSV validation, duplicate handling, cleanup and spreadsheet-injection protection.
- Added safer search filtering and duplicate phone-number responses.

## Deployment and validation

- Added safe backend and dashboard `.env.example` files.
- Added `validate-project.ps1` for one-command Windows validation.
- Added a full validation report and setup README.
