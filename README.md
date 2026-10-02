# GUVEL PrePPAP Tracker — Supabase Edition

This version keeps the visual structure of GUVEL PrePPAP Tracker V2 FIXED and replaces localStorage/SharePoint persistence with Supabase.

## Architecture

- GitHub Pages: frontend
- Supabase Auth: user login
- Supabase PostgreSQL: orders, tasks, compensation, document metadata
- Supabase Storage: PrePPAP documents and folder-like prefixes
- localStorage: NOT used for application data

## 1. Create Supabase project

Create a project in Supabase.

Then open:
SQL Editor → New query

Paste and run `supabase_schema.sql`.

## 2. Create your first user

Supabase Dashboard → Authentication → Users → Add user.

Use the email/password you want for GUVEL.

## 3. Get API values

Supabase Dashboard → Project Settings → API

Copy:
- Project URL
- anon / publishable key

Put them in `config.js`:

SUPABASE_URL
SUPABASE_ANON_KEY

Never put the service_role key in this project.

## 4. Run locally

Because ES modules are used, serve the folder from a local HTTP server. Do not open index.html directly with file://.

Example:
python -m http.server 8080

Then open:
http://localhost:8080

## 5. GitHub Pages

Upload the project to a GitHub repository and enable GitHub Pages.

Add the GitHub Pages URL to:
Supabase → Authentication → URL Configuration → Site URL

If you use email confirmation or redirects, add the same URL under Redirect URLs.

## 6. Storage model

Supabase Storage does not have true empty folders. GUVEL creates a `.keep` object in each of the 9 prefixes so they appear as folders.

Example:

preppap-documents/
  PP-2026-001 | Customer | Part Number/
    01_Cotizacion_MES_Cliente/
    02_PO_Cliente_MES/
    ...
    09_Factura_MES_Cliente/

## 7. Important security note

Use only the Supabase anon/publishable key in the browser.

Never expose:
- service_role key
- database password
- private server credentials

RLS policies in the SQL restrict application data to authenticated users.

## Current implementation

Included:
- Supabase authentication
- Order CRUD creation
- PostgreSQL persistence
- Automatic PrePPAP numbering
- 9 Storage prefixes per order
- Automatic compensation record for partial MES PO → MWS quantity
- Compensation editing
- Task persistence
- Document metadata
- Document upload and signed download
- Dashboard / Orders / Tasks / Compensation / Shipments views
- Existing GUVEL visual structure preserved

## Next optional hardening

Before company-wide deployment:
- Add role-based permissions (Admin, Quality, Engineering, Purchasing, Logistics, Finance, Viewer)
- Add audit trail
- Add document-category selection in upload
- Add edit-order workflow
- Add automatic task status transitions


## Authentication troubleshooting

If a user was created manually in Supabase Authentication → Users but GUVEL rejects the login:

1. Supabase → Authentication → Users.
2. Open the user.
3. Confirm the user's email / mark it confirmed if your dashboard exposes that control.
4. Verify the password by resetting it if necessary.
5. Supabase → Authentication → Providers → Email:
   - For internal testing, Email provider may be configured without email confirmation.
   - For production, keep confirmation enabled and use the company's email workflow.

The browser app only needs the Project URL and anon/publishable key. Never use the service_role key in config.js.

The login screen is now part of the GUVEL visual system and does not expose a separate generic login template.


## Storage path fix

Storage folder keys are now separated from the display name.

Example display:
`PP-2026-002 | Schneider Electric | GHD12275AA`

Internal Storage prefix:
`PP-2026-002-Schneider-Electric-GHD12275AA`

This prevents characters such as `|`, `/`, `:`, `%`, `&`, quotes, brackets, etc. from becoming invalid Storage keys.

If a previous failed order created no files, simply create it again. If a partial folder was created, it can be left or deleted manually from Storage.
