# GUVEL PrePPAP Tracker V9

Business-style PrePPAP control portal using GitHub Pages + Supabase.

## V9 changes
- Evidence upload limit increased from 50 KB to 2 MB.
- Upload is stable: evidence uploads update the open gate without closing/reloading the modal, so typed reference/details are preserved.
- Drag & drop remains available.
- Evidence files can be deleted from the gate.
- Seven active workflow items; legacy Shipping/FedEx items are no longer displayed.
- Shipment gate is conditional on Shipping Method:
  - Monterrey → Customer: automatically Completed.
  - MWS → Customer: evidence required and remains open.
- Gate 04 captures PO number and quantity.
- Gate 05 has a structured PO vs Invoice reconciliation and creates a compensation record only when quantities differ and the gate is completed.
- Pending Balance KPI uses the PrePPAP database ID: mismatch + no compensation record = Pending. Once any balance record exists for that PrePPAP, it is no longer counted as Pending.
- Existing documents and historical tasks are preserved.

## Supabase
Run `MIGRATION_V9.sql` once in Supabase SQL Editor. Do not run cleanup scripts for this update.
