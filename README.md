# GUVEL PrePPAP Tracker V7

Business-style Supabase/GitHub Pages tracker.

## V7
- Fixes missing `details` schema-cache issue.
- Drag & drop evidence upload with 50 KB limit.
- Safe yearly order numbering from V6.
- Initial PrePPAP creation does not create PO Balance records.
- MWS Invoice → MES captures PO MES quantity and MWS invoice quantity.
- Quantity mismatch generates the PO Balance only when the MWS Invoice → MES gate is completed.

## Setup
1. Keep your existing `config.js` credentials.
2. Run `MIGRATION_V7.sql` once in Supabase SQL Editor.
3. Deploy the V7 files to GitHub Pages.
