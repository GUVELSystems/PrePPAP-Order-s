-- GUVEL PrePPAP V7 migration
-- Run once in Supabase SQL Editor.

-- The V6 schema already defines these columns, but older databases may not have them.
alter table public.preppap_tasks add column if not exists reference text;
alter table public.preppap_tasks add column if not exists details text;

-- Ensure the current PO type model is used.
alter table public.preppap_compensations alter column po_type set default 'Invoice vs PO';

do $$
begin
  if exists (select 1 from pg_constraint where conrelid='public.preppap_compensations'::regclass and conname='preppap_compensations_po_type_check') then
    alter table public.preppap_compensations drop constraint preppap_compensations_po_type_check;
  end if;
exception when undefined_table then null;
end $$;

alter table public.preppap_compensations
  add constraint preppap_compensations_po_type_check
  check (po_type in ('Invoice vs PO','PO vs Invoice'));

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
