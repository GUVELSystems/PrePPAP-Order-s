-- GUVEL PrePPAP Tracker - V5 order-number concurrency fix
-- Run this once in Supabase > SQL Editor.
-- This does not delete or modify existing orders, documents, tasks, or Storage files.

create or replace function public.next_preppap_order_number()
returns text
language plpgsql
as $$
declare
  y text := to_char(current_date, 'YYYY');
  n integer;
begin
  -- Prevent concurrent users from receiving the same PP-YYYY-NNN value.
  perform pg_advisory_xact_lock(hashtext('GUVEL_PREPPAP_ORDER_NUMBER_' || y));

  select coalesce(max((regexp_match(order_number, '^PP-' || y || '-([0-9]+)$'))[1]::integer), 0) + 1
    into n
  from public.preppap_orders;

  return 'PP-' || y || '-' || lpad(n::text, 3, '0');
end;
$$;

notify pgrst, 'reload schema';
