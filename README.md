# GUVEL PrePPAP Tracker — V4 Business

Business-oriented, formal GUVEL PrePPAP control portal built for GitHub Pages + Supabase.

## V4 highlights

- Formal Business UI: light, structured, low-noise visual system with GUVEL cyan/red accents.
- PrePPAP Orders can be opened, closed and selected again without losing row interactions.
- Evidence Flow rows open the corresponding PrePPAP gate directly, including the upload/completion window.
- Every workflow gate requires evidence before completion.
- Maximum file size: **50 KB** for every uploaded file.
- PO Balance `PO Type` is limited to:
  - `Invoice vs PO`
  - `PO vs Invoice`
- Cancelling a PrePPAP changes only its status to `Cancelled`.
  - Documents remain.
  - Storage files remain.
  - Tasks remain.
  - Compensation/history remains.
  - Cancelled orders are excluded from Dashboard and active Evidence Flow.
- PrePPAP Orders includes **Export ZIP**.
  - Filename: `PrePPAP Order YYYY-MM-DD.zip`
  - One folder per PrePPAP order.
  - Evidence files are grouped inside their workflow folders.
- `CLEAN_START.sql` no longer attempts forbidden direct deletion from `storage.objects`.
- `CLEAN_STORAGE.html` performs Storage cleanup through the Supabase Storage API.

## First-time / existing project setup

### 1. Existing project: run the migration
Run `MIGRATION_V4.sql` in **Supabase → SQL Editor** once.

This is required if your project already existed before V4. It adds `preppap_orders.status` and reloads the PostgREST schema cache.

### 2. New project: run the full schema
Run `supabase_schema.sql`.

### 3. Configure the frontend
Edit `config.js` with the Supabase project URL and Anon/Publishable Key.

### 4. Authentication
Create/confirm the user in Supabase Authentication and sign in through the portal.

## Clean demo/test data

If you want a completely empty application database:

1. Run `CLEAN_START.sql`.
2. If you also want the old/demo Storage files removed, open `CLEAN_STORAGE.html`, enter the same Supabase URL/key and sign in, then run the cleanup.

This split is intentional because Supabase prevents direct SQL deletion from `storage.objects`.

## Export ZIP behavior

The export uses signed Storage URLs in the browser. It exports all currently listed PrePPAP orders, including Cancelled orders, preserving the order's evidence files.

Example:

```text
PrePPAP Order 2026-10-02.zip
├── PP-2026-001/
│   ├── 01_Cotizacion_MES_Cliente/
│   │   └── quotation.pdf
│   ├── 02_PO_Cliente_MES/
│   │   └── customer-po.pdf
│   └── ...
└── PP-2026-002/
    └── ...
```
