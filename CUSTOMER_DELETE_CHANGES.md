# Customer delete option

Added a permanent customer delete action to the dashboard.

- Delete icon appears beside **Start Call** in the customer table.
- A confirmation prompt appears before deletion.
- Customers cannot be deleted while a call is active or while a campaign is running.
- Deleting a customer also removes that ID from the locally stored latest-campaign summary.
- Backend endpoint: `DELETE /api/leads/:leadId`.
