# Admin Activity Log and Geojit Logo Update

## Added

- New protected `Activity Log` page in the dashboard.
- Activity summary cards for total activity, today's activity, successful actions, failed actions, and active administrators.
- Search and filters for category and result.
- Activity-log CSV export.
- MongoDB `ActivityLog` model and protected activity-log API routes.
- Login and manual logout audit entries.
- Audit entries for customer creation, CSV upload, customer deletion, individual Exotel call start, campaign start/stop/completion, callback follow-up updates, and exports.
- Supplied Geojit logo on the login page, dashboard navigation, and browser favicon.

## Security

- Activity-log APIs require the existing administrator JWT.
- Exotel webhooks remain public and unchanged.
- Passwords, API tokens, authorization headers, secrets, and JWT values are removed from activity metadata.
- Failed login entries never store the submitted password.

## API routes

- `GET /api/activity-logs`
- `GET /api/activity-logs/export`
- `POST /api/activity-logs/events`
- `POST /api/auth/logout`

No new environment variables are required.
