-- GUVEL PrePPAP V6
-- Safe yearly order-number allocator. Run once in Supabase SQL Editor.

create table if not exists public.preppap_order_sequences (
  year integer primary key,
  last_number integer not null default 0 check (last_number >= 0)
);

-- Seed the current year from existing orders without overwriting an existing sequence.
do $$
declare
  y integer := extract(year from current_date)::integer;
  current_max integer;
begin
  select coalesce(max((regexp_match(order_number, '^PP-' || y::text || '-([0-9]+)$'))[1]::integer),0)
    into current_max
  from public.preppap_orders;

  insert into public.preppap_order_sequences(year,last_number)
  values(y,current_max)
  on conflict (year) do nothing;
end $$;

create or replace function public.next_preppap_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := extract(year from current_date)::integer;
  n integer;
begin
  -- The row-level UPDATE is atomic: concurrent users wait for the row lock
  -- and receive different consecutive numbers.
  insert into public.preppap_order_sequences(year,last_number)
  values (y,0)
  on conflict (year) do nothing;

  update public.preppap_order_sequences
     set last_number = last_number + 1
   where year = y
   returning last_number into n;

  return 'PP-' || y::text || '-' || lpad(n::text,3,'0');
end;
$$;

revoke all on function public.next_preppap_order_number() from public;
grant execute on function public.next_preppap_order_number() to authenticated;
