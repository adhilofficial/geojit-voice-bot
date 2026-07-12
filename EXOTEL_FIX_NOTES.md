# Exotel backend fix

Updated files:

- `backend/src/services/exotelService.js`
  - Removed the duplicate `providerCallId` declaration that caused a JavaScript syntax error.
  - Handles JSON, XML, and successful empty Exotel responses.
  - Does not treat a successfully accepted call as a 502 when the immediate Call SID is missing.
  - Adds the MongoDB lead ID to the StatusCallback URL.
  - Keeps `StatusCallbackEvents` disabled because the trial account rejected it.

- `backend/src/controllers/exotelCallController.js`
  - Saves an immediate Call SID when available.
  - Returns HTTP 202 for accepted Exotel calls even when the SID arrives later through the webhook.
  - Adds safer provider error logging without logging API secrets.

- `backend/src/controllers/exotelWebhookController.js`
  - Finds the customer using `leadId`, `CustomField`, or `CallSid`.
  - Saves terminal status, duration, recording URL, and provider Call SID.

- `backend/src/models/Lead.js`
  - Adds `providerStatus` and `recordingUrl`.
  - Indexes `providerCallId`.

- `backend/src/app.js`
  - Removes duplicate route registration.
  - Registers all routes before the 404 and error handlers.
  - Improves health and CORS handling.

Validation completed:

- All backend JavaScript files passed `node --check`.
- Backend application loaded successfully.
- Exotel response parsing smoke tests passed.
- Dashboard production build passed.

The ZIP intentionally excludes `.env`, `node_modules`, `.git`, and build output.
