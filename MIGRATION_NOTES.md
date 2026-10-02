# Migration notes

Removed from the runtime:
- SharePoint adapter
- MSAL
- localStorage persistence

The visual baseline remains the fixed V2 portal. The new runtime imports:
- supabase.js
- supabase_api.js
- config.js
- data.js

The database is now the source of truth.

## V2 FUTURE changes

- `preppap_tasks.reference` and `preppap_tasks.details` added.
- Evidence is mandatory for completion.
- DB trigger blocks completion without evidence.
- All evidence files limited to 50 KB.
- Storage bucket configured with 51200-byte file limit.
- `CLEAN_START.sql` provided for destructive cleanup of old demo/test data.
