# GUVEL PrePPAP V9 Migration

Run `MIGRATION_V9.sql` once in Supabase SQL Editor.

- Evidence limit: 2 MB.
- Adds the new 7-step workflow and Shipment task to existing orders without deleting historical tasks/documents.
- Monterrey → Customer automatically completes Shipment.
- MWS → Customer keeps Shipment open for evidence.
- Rebuilds the evidence-enforcement trigger for the new folder/task mapping.
- Reloads PostgREST schema cache.

No cleanup or deletion is required.
