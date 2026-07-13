# Campaign Reporting Update

## Added

- A live campaign result summary on the Call Campaigns page.
- Result counters for total called, completed, interested, callback requests, no answer, busy, failed, and opted out.
- Browser persistence for the latest campaign's attempted customer IDs.
- A Clear Summary action.
- An Export Campaign Results button.
- A protected backend CSV export endpoint: `POST /api/leads/export/campaign`.
- Spreadsheet-formula sanitization for campaign CSV values.
- Safe backend and dashboard `.env.example` files.

## Campaign CSV columns

- Customer Name
- Phone Number
- Campaign
- Call Status
- Provider Status
- Selected Service
- Callback Requested
- Opted Out
- Call Attempts
- Call Duration Seconds
- Last Called
- Provider Call ID

## Behavior

The summary tracks only customers that the live campaign attempted. It remains visible after a browser refresh until a new campaign starts or Clear Summary is selected.
