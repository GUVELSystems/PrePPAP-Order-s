-- GUVEL PrePPAP Tracker
-- Supabase SQL setup
-- Run this entire script in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.preppap_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer text not null,
  part_number text not null,
  revision text,
  purpose text not null default 'Pre-Production',
  request_date date default current_date,
  required_date date,
  qty_requested numeric(12,2) not null default 0 check (qty_requested >= 0),
  qty_shipped numeric(12,2) not null default 0 check (qty_shipped >= 0),
  qty_invoiced numeric(12,2) not null default 0 check (qty_invoiced >= 0),
  priority text not null default 'Normal',
  owner text,
  shipping_method text,
  customer_po text,
  customer_po_qty numeric(12,2) not null default 0,
  preppap_request text,
  mes_po text,
  mes_po_qty numeric(12,2) not null default 0,
  mws_invoice text,
  mws_invoice_qty numeric(12,2) not null default 0,
  fedex text,
  folder_path text,
  comments text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preppap_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.preppap_orders(id) on delete cascade,
  task_code text not null,
  task_name text not null,
  from_party text,
  to_party text,
  status text not null default 'Not Started',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, task_code)
);

create table if not exists public.preppap_compensations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.preppap_orders(id) on delete cascade,
  po_type text not null default 'MES PO to MWS',
  po_number text,
  ordered_qty numeric(12,2) not null default 0,
  delivered_qty numeric(12,2) not null default 0,
  action text,
  related_po text,
  resolution_date date,
  status text not null default 'Open',
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preppap_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.preppap_orders(id) on delete cascade,
  task_code text,
  document_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_preppap_orders_created_at on public.preppap_orders(created_at desc);
create index if not exists idx_preppap_tasks_order on public.preppap_tasks(order_id);
create index if not exists idx_preppap_comp_order on public.preppap_compensations(order_id);
create index if not exists idx_preppap_docs_order on public.preppap_documents(order_id);

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_preppap_orders_updated on public.preppap_orders;
create trigger trg_preppap_orders_updated
before update on public.preppap_orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_preppap_comp_updated on public.preppap_compensations;
create trigger trg_preppap_comp_updated
before update on public.preppap_compensations
for each row execute function public.set_updated_at();

-- Order number generator: PP-YYYY-NNN
create or replace function public.next_preppap_order_number()
returns text
language plpgsql
as $$
declare
  y text := to_char(current_date, 'YYYY');
  n integer;
begin
  select coalesce(max((regexp_match(order_number, '^PP-' || y || '-([0-9]+)$'))[1]::integer), 0) + 1
    into n
  from public.preppap_orders;
  return 'PP-' || y || '-' || lpad(n::text, 3, '0');
end;
$$;

-- RLS
alter table public.preppap_orders enable row level security;
alter table public.preppap_tasks enable row level security;
alter table public.preppap_compensations enable row level security;
alter table public.preppap_documents enable row level security;

drop policy if exists "Authenticated users can read orders" on public.preppap_orders;
create policy "Authenticated users can read orders"
on public.preppap_orders for select
to authenticated using (true);

drop policy if exists "Authenticated users can insert orders" on public.preppap_orders;
create policy "Authenticated users can insert orders"
on public.preppap_orders for insert
to authenticated with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update orders" on public.preppap_orders;
create policy "Authenticated users can update orders"
on public.preppap_orders for update
to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete orders" on public.preppap_orders;
create policy "Authenticated users can delete orders"
on public.preppap_orders for delete
to authenticated using (true);

drop policy if exists "Authenticated users can read tasks" on public.preppap_tasks;
create policy "Authenticated users can read tasks"
on public.preppap_tasks for select to authenticated using (true);

drop policy if exists "Authenticated users can write tasks" on public.preppap_tasks;
create policy "Authenticated users can write tasks"
on public.preppap_tasks for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read compensation" on public.preppap_compensations;
create policy "Authenticated users can read compensation"
on public.preppap_compensations for select to authenticated using (true);

drop policy if exists "Authenticated users can write compensation" on public.preppap_compensations;
create policy "Authenticated users can write compensation"
on public.preppap_compensations for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read documents" on public.preppap_documents;
create policy "Authenticated users can read documents"
on public.preppap_documents for select to authenticated using (true);

drop policy if exists "Authenticated users can write documents" on public.preppap_documents;
create policy "Authenticated users can write documents"
on public.preppap_documents for all to authenticated using (true) with check (true);

-- Storage bucket. The UI creates the 9 prefixes by uploading .keep files.
insert into storage.buckets (id, name, public)
values ('preppap-documents', 'preppap-documents', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read PrePPAP files" on storage.objects;
create policy "Authenticated users can read PrePPAP files"
on storage.objects for select
to authenticated
using (bucket_id = 'preppap-documents');

drop policy if exists "Authenticated users can upload PrePPAP files" on storage.objects;
create policy "Authenticated users can upload PrePPAP files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'preppap-documents');

drop policy if exists "Authenticated users can update PrePPAP files" on storage.objects;
create policy "Authenticated users can update PrePPAP files"
on storage.objects for update
to authenticated
using (bucket_id = 'preppap-documents')
with check (bucket_id = 'preppap-documents');

drop policy if exists "Authenticated users can delete PrePPAP files" on storage.objects;
create policy "Authenticated users can delete PrePPAP files"
on storage.objects for delete
to authenticated
using (bucket_id = 'preppap-documents');

-- Optional seed of the standard workflow definitions is kept in the frontend
-- so the database stays order-specific and lightweight.
