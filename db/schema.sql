-- GUVEL PrePPAP — ESQUEMA COMPLETO (instalación nueva)
-- Ejecutar completo en Supabase > SQL Editor sobre un proyecto vacío.
-- Si ya tienes datos, usa migration_v10.sql en su lugar.

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
  status text not null default 'Active' check (status in ('Active','Cancelled')),
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
  reference text,
  details text,
  created_at timestamptz not null default now(),
  unique(order_id, task_code)
);

create table if not exists public.preppap_compensations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.preppap_orders(id) on delete cascade,
  po_type text not null default 'Invoice vs PO',
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
  size_bytes bigint check (size_bytes is null or size_bytes <= 2097152),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_preppap_orders_created_at on public.preppap_orders(created_at desc);
create index if not exists idx_preppap_tasks_order on public.preppap_tasks(order_id);
create index if not exists idx_preppap_comp_order on public.preppap_compensations(order_id);
create index if not exists idx_preppap_docs_order on public.preppap_documents(order_id);

-- V3 order cancellation
alter table public.preppap_orders add column if not exists status text not null default 'Active';
update public.preppap_orders set status='Active' where status is null;
alter table public.preppap_orders drop constraint if exists preppap_orders_status_check;
alter table public.preppap_orders add constraint preppap_orders_status_check check (status in ('Active','Cancelled'));

-- V2 task evidence fields / hard file limit
alter table public.preppap_tasks add column if not exists reference text;
alter table public.preppap_tasks add column if not exists details text;
alter table public.preppap_documents drop constraint if exists preppap_documents_size_bytes_check;
alter table public.preppap_documents add constraint preppap_documents_size_bytes_check
  check (size_bytes is null or size_bytes <= 2097152);

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

-- Safe yearly order-number allocator
create table if not exists public.preppap_order_sequences (
  year integer primary key,
  last_number integer not null default 0 check (last_number >= 0)
);

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

-- Storage bucket (privado). La app crea las 7 carpetas subiendo archivos .keep.
insert into storage.buckets (id, name, public, file_size_limit)
values ('preppap-documents', 'preppap-documents', false, 2097152)
on conflict (id) do update
set file_size_limit = 2097152;

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

-- Evidencia obligatoria a nivel base de datos (versión corregida V10)
create or replace function public.enforce_preppap_task_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count   integer;
  v_folder  text;
  v_method  text;
begin
  if new.status = 'Completed' and (tg_op = 'INSERT' or old.status is distinct from 'Completed') then
    select o.shipping_method into v_method from public.preppap_orders o where o.id = new.order_id;

    -- Envío desde Monterrey: se completa sin evidencia.
    if new.task_code = 'Shipment' and v_method = 'Monterrey → Customer' then
      return new;
    end if;

    v_folder := case new.task_code
      when 'Quote'          then '01_Cotizacion_Metrics_Mexico_Customer'
      when 'CustomerPO'     then '02_PO_Customer_Metrics_Mexico'
      when 'PrePPAPRequest' then '03_PrePPAP_Order_Request'
      when 'MESPO'          then '04_PO_Metrics_Mexico_Metrics_Works'
      when 'MWSInvoice'     then '05_Invoice_Metrics_Works_Metrics_Mexico'
      when 'Shipment'       then '06_Shipment_Process'
      when 'MESInvoice'     then '07_Invoice_Metrics_Mexico_Customer'
      else new.task_code
    end;

    select count(*) into v_count
    from public.preppap_documents d
    where d.order_id = new.order_id and d.task_code = v_folder;

    if v_count = 0 then
      raise exception 'PREPPAP_EVIDENCE_REQUIRED: Task % cannot be completed without an evidence file.', new.task_code;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preppap_task_evidence on public.preppap_tasks;
create trigger trg_preppap_task_evidence
before update on public.preppap_tasks
for each row execute function public.enforce_preppap_task_evidence();


create index if not exists idx_preppap_docs_order_task on public.preppap_documents(order_id, task_code);

notify pgrst, 'reload schema';
