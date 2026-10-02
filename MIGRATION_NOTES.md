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
