-- GUVEL PrePPAP — MIGRACIÓN V11: facturas parciales + balance automático
-- Ejecutar UNA vez en Supabase > SQL Editor DESPUÉS de migration_v10.sql. Es seguro repetirla.
--
-- Modelo:
--   * Una orden tiene un PO a Metrics Works (preppap_orders.mes_po_qty).
--   * Metrics Works puede emitir varias facturas parciales (preppap_invoices), cada una con sus archivos.
--   * Facturado = suma de facturas. Faltante = PO - facturado.
--   * Al completar la etapa "Factura de Metrics Works" con faltante > 0 se abre un balance ligado a la orden.
--   * Cada factura de reposición actualiza el balance (Parcial) y lo cierra cuando la suma alcanza el PO.

create table if not exists public.preppap_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.preppap_orders(id) on delete cascade,
  invoice_number text not null,
  qty numeric(12,2) not null check (qty > 0),
  invoice_date date default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_preppap_invoices_order on public.preppap_invoices(order_id);

alter table public.preppap_invoices enable row level security;
drop policy if exists "Authenticated users can read invoices" on public.preppap_invoices;
create policy "Authenticated users can read invoices" on public.preppap_invoices for select to authenticated using (true);
drop policy if exists "Authenticated users can write invoices" on public.preppap_invoices;
create policy "Authenticated users can write invoices" on public.preppap_invoices for all to authenticated using (true) with check (true);

-- Cada archivo puede pertenecer a una factura concreta (null = evidencia general de la etapa).
alter table public.preppap_documents add column if not exists invoice_id uuid references public.preppap_invoices(id) on delete cascade;
create index if not exists idx_preppap_docs_invoice on public.preppap_documents(invoice_id);

-- Balance: crea / actualiza / cierra el registro según PO vs facturas.
create or replace function public.sync_preppap_balance(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po numeric; v_mes text; v_inv numeric; v_done boolean;
  v_open_id uuid; v_open_deliv numeric;
begin
  select o.mes_po_qty, o.mes_po into v_po, v_mes from public.preppap_orders o where o.id = p_order_id;
  if not found then return; end if;

  select coalesce(sum(i.qty), 0) into v_inv from public.preppap_invoices i where i.order_id = p_order_id;
  select exists (select 1 from public.preppap_tasks t
                  where t.order_id = p_order_id and t.task_code = 'MWSInvoice' and t.status = 'Completed') into v_done;
  select c.id, c.delivered_qty into v_open_id, v_open_deliv
    from public.preppap_compensations c
   where c.order_id = p_order_id and c.status in ('Open', 'Partial')
   order by c.created_at desc limit 1;

  if v_po > 0 and v_inv >= v_po then
    -- PO cumplido: se cierra el balance abierto.
    if v_open_id is not null then
      update public.preppap_compensations
         set ordered_qty = v_po, delivered_qty = v_inv, status = 'Closed',
             resolution_date = coalesce(resolution_date, current_date)
       where id = v_open_id;
    end if;
  elsif v_po > 0 and v_done then
    if v_open_id is not null then
      update public.preppap_compensations
         set ordered_qty = v_po, delivered_qty = v_inv,
             status = case when v_inv > coalesce(v_open_deliv, 0) then 'Partial' else status end
       where id = v_open_id;
    elsif not exists (select 1 from public.preppap_compensations c
                       where c.order_id = p_order_id and c.status = 'Closed' and c.delivered_qty < c.ordered_qty) then
      -- No se reabre un balance que alguien cerró a propósito sin reponer.
      insert into public.preppap_compensations (order_id, po_type, po_number, ordered_qty, delivered_qty, status, comments)
      values (p_order_id, 'PO vs Invoice', v_mes, v_po, v_inv, 'Open',
              'Generado automáticamente: la suma de facturas de Metrics Works es menor al PO.');
    end if;
  end if;
end;
$$;
revoke all on function public.sync_preppap_balance(uuid) from public;
grant execute on function public.sync_preppap_balance(uuid) to authenticated;

-- Cada cambio en facturas mantiene los totales de la orden y el balance.
create or replace function public.trg_preppap_invoices_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_order uuid := case tg_op when 'DELETE' then old.order_id else new.order_id end;
begin
  update public.preppap_orders o
     set mws_invoice_qty = (select coalesce(sum(i.qty), 0) from public.preppap_invoices i where i.order_id = v_order),
         mws_invoice     = (select string_agg(i.invoice_number, ', ' order by i.created_at) from public.preppap_invoices i where i.order_id = v_order)
   where o.id = v_order;
  perform public.sync_preppap_balance(v_order);
  return null;
end;
$$;

drop trigger if exists trg_preppap_invoices_after on public.preppap_invoices;
create trigger trg_preppap_invoices_after
after insert or update or delete on public.preppap_invoices
for each row execute function public.trg_preppap_invoices_after();

-- Órdenes anteriores: lo que ya estaba facturado pasa a ser una factura registrada.
insert into public.preppap_invoices (order_id, invoice_number, qty, created_at)
select o.id, coalesce(nullif(trim(o.mws_invoice), ''), 'Factura registrada'), o.mws_invoice_qty, o.created_at
from public.preppap_orders o
where o.mws_invoice_qty > 0
  and not exists (select 1 from public.preppap_invoices i where i.order_id = o.id);

notify pgrst, 'reload schema';
