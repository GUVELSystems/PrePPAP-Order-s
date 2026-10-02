# GUVEL PrePPAP Tracker — V4

## Required database step
For an existing Supabase project, run `MIGRATION_V4.sql` once in **Supabase → SQL Editor**. This adds `preppap_orders.status`, keeps existing data, and reloads the PostgREST schema cache.

### Cancellation behavior
Cancelling a PrePPAP only changes `preppap_orders.status` to `Cancelled`.

It does **not** delete:
- uploaded documents
- Storage files
- evidence records
- tasks
- PO compensation records
- historical order information

Cancelled orders are excluded from the active Dashboard and Evidence Flow.

## Clean start
`CLEAN_START.sql` now deletes only application rows. Supabase intentionally blocks direct SQL deletes from `storage.objects`.

If you also need to remove old/demo files from the Storage bucket, run `CLEAN_STORAGE.html` in a browser and sign in with the same Supabase user. It removes bucket objects through the Storage API.

## Export
PrePPAP Orders now has **Export ZIP**. The download is named:

`PrePPAP Order YYYY-MM-DD.zip`

Each PrePPAP gets its own folder, and each evidence file is stored under its corresponding workflow folder.
