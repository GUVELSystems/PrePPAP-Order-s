# V7 Migration

Run `MIGRATION_V7.sql` once in Supabase SQL Editor.

## Fixes
- Adds `preppap_tasks.reference` and `preppap_tasks.details` for databases created before the evidence metadata migration.
- Keeps PO Balance types restricted to `Invoice vs PO` and `PO vs Invoice`.
- Removes automatic PO Balance creation during initial PrePPAP creation.
- MWS Invoice → MES now captures `Cantidad de PO MES` and `Cantidad Factura MWS` at that gate.
- If those quantities differ, the system generates/updates the corresponding PO Balance only when that gate is completed.
- If they match, no balance record is generated.
