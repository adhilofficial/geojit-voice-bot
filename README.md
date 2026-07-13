# Separate administrator passwords

This patch changes administrator authentication from one shared password to one password hash per email.

## Environment variables

Keep the existing primary administrator variables:

```env
ADMIN_EMAIL=your-current-admin@example.com
ADMIN_PASSWORD_HASH=HASH_FOR_THE_CURRENT_ADMIN
```

Add the second administrator:

```env
ADMIN_EMAIL_2=towards.mohit12@gmail.com
ADMIN_PASSWORD_HASH_2=HASH_FOR_MOHIT
```

Delete the old `ADMIN_EMAILS` variable after the numbered variables are configured. It is no longer used by the login controller.

Additional administrators can use `ADMIN_EMAIL_3` with `ADMIN_PASSWORD_HASH_3`, and so on.

## Generate each password hash

Run `npm run hash-password` once for the first administrator and once again for the second administrator. Store only the generated hashes in Render. Never store plain passwords in GitHub, Vercel, or source files.

## Admin activity log

The protected dashboard includes an Activity Log page for administrator access, customer operations, calls, campaigns, callback follow-ups, and exports. Activity records are stored in MongoDB and can be exported as CSV.
