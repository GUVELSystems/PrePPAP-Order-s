# GUVEL PrePPAP Tracker V6

Business-style PrePPAP control portal using GitHub Pages + Supabase Auth/Postgres/Storage.

## Setup
1. Keep your Supabase URL and anon/publishable key in `config.js`.
2. If this is a new project, run `supabase_schema.sql`.
3. If upgrading from V5, run `MIGRATION_V6.sql` once.
4. Deploy the folder to GitHub Pages.

## V6 changes
- Safe yearly PrePPAP order-number allocator using a database sequence table.
- Existing order numbers are preserved; cancelled numbers are never reused.
- New-order modal is intentionally minimal: Customer, Part Number, Revision, Purpose, Request Date, Required Date, Qty Requested, Priority, Owner, Shipping Method.
- Remaining commercial/logistics/evidence fields stay available in the PrePPAP Order detail.
- Evidence upload supports drag & drop and normal file selection.
- 50 KB maximum enforced in the browser, database and Storage.
- Existing V4/V5 cancellation, evidence retention, Business UI and ZIP export remain.
