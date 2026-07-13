# Callback Follow-up Queue Changes

## Backend

- Added callback follow-up fields to the Lead model:
  - `callbackFollowUpStatus`
  - `callbackRequestedAt`
  - `callbackContactedAt`
  - `callbackCompletedAt`
- Real Exotel digit `4` now creates a Pending follow-up automatically.
- Mock callback responses also create a Pending follow-up.
- Added callback queue retrieval, status update, and CSV export endpoints.
- Existing records with `callbackRequested: true` and no follow-up status are treated as Pending.
- Expanded CORS methods to support PATCH and DELETE requests from the dashboard.

## Dashboard

- Added a **Callback Requests** navigation tab.
- Added Pending, Contacted, and Completed summary counters.
- Added customer search and follow-up status filtering.
- Added **Mark Contacted** and **Mark Completed** actions.
- Added **Export Callback List**.
- Added Pending Follow-ups to the main dashboard statistics.

## CSV columns

- Customer Name
- Phone Number
- Campaign
- Selected Service
- Follow-up Status
- Requested At
- Contacted At
- Completed At
- Last Called
- Call Status
