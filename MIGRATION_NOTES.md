# GUVEL PrePPAP Tracker V6

## Required migration
Run `MIGRATION_V6.sql` once in Supabase SQL Editor.

### What V6 fixes
- Replaces the `MAX()+1` / advisory-lock order number allocator with a dedicated yearly sequence table.
- Existing `PP-YYYY-NNN` orders are scanned and the current year's sequence is initialized above the highest existing number.
- Concurrent order creation receives unique consecutive numbers.
- Cancelled order numbers are never reused.
- Existing orders, documents, tasks, compensations and Storage files are not deleted.

## UI changes
- New PrePPAP Order form only asks for:
  Customer, Part Number, Revision, Purpose, Request Date, Required Date, Qty Requested, Priority, Owner, Shipping Method.
- The rest of the PrePPAP Order record remains available after creation.
- Evidence upload supports click-to-select and drag & drop.
- 50 KB maximum remains enforced for every evidence file.
