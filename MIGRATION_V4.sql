-- GUVEL PrePPAP Tracker - V4 database migration
-- Run this ONCE in Supabase > SQL Editor for an existing project.
-- This migration does NOT delete or modify existing documents/files.

alter table public.preppap_orders
  add column if not exists status text;

update public.preppap_orders
set status = 'Active'
where status is null or status not in ('Active','Cancelled');

alter table public.preppap_orders
  alter column status set default 'Active';

alter table public.preppap_orders
  alter column status set not null;

drop constraint if exists preppap_orders_status_check on public.preppap_orders;
alter table public.preppap_orders
  add constraint preppap_orders_status_check
  check (status in ('Active','Cancelled'));

-- Refresh PostgREST schema cache so the web app sees the new column immediately.
notify pgrst, 'reload schema';
