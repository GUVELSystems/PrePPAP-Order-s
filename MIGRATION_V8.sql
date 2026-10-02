-- GUVEL PrePPAP V8
-- Safe migration: no deletes. Keeps historical compensation rows.

alter table public.preppap_tasks add column if not exists reference text;
alter table public.preppap_tasks add column if not exists details text;

alter table public.preppap_compensations alter column po_type set default 'Invoice vs PO';
alter table public.preppap_compensations drop constraint if exists preppap_compensations_po_type_check;

notify pgrst, 'reload schema';
