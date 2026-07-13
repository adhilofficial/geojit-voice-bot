# Geojit Callback Follow-up Patch

Copy the contents of this patch into the existing `geojit-voice-bot` project root.

This patch adds:

- Callback Requests navigation page
- Pending, Contacted, and Completed follow-up statuses
- Mark Contacted and Mark Completed actions
- Callback summary counters
- Callback CSV export
- Automatic queue creation when Exotel digit `4` is received
- Compatibility with older callback records
- PATCH and DELETE CORS support

No `.env` files or credentials are included.
