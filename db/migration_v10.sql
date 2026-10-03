-- GUVEL PrePPAP — MIGRACIÓN V10
-- Ejecutar UNA vez en Supabase > SQL Editor sobre una base que ya tiene V9 (o anterior).
-- No borra órdenes, tareas, documentos ni compensaciones.

-- 1) Corrige el trigger de evidencia.
--    En V9 la variable "shipping_method" tenía el mismo nombre que la columna de
--    preppap_orders; PostgreSQL lanzaba "column reference is ambiguous" y
--    COMPLETAR UNA ETAPA FALLABA SIEMPRE. Además ahora solo valida al PASAR a
--    Completed, así que guardar notas en una etapa ya completada no se bloquea.
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

-- 2) Límite de evidencia: 2 MB (CLEAN_START.sql lo había dejado en 50 KB).
alter table public.preppap_documents drop constraint if exists preppap_documents_size_bytes_check;
alter table public.preppap_documents add constraint preppap_documents_size_bytes_check
  check (size_bytes is null or size_bytes <= 2097152);
update storage.buckets set file_size_limit = 2097152 where id = 'preppap-documents';

-- 3) Índice para acelerar la consulta de evidencia por etapa.
create index if not exists idx_preppap_docs_order_task on public.preppap_documents(order_id, task_code);

-- 4) Asegura que existan las 7 etapas en órdenes antiguas (no toca las existentes).
insert into public.preppap_tasks (order_id, task_code, task_name, from_party, to_party, status, due_date, completed_at)
select o.id, g.code, g.name, g.from_party, g.to_party,
       case when g.code = 'Shipment' and o.shipping_method = 'Monterrey → Customer' then 'Completed' else 'Not Started' end,
       o.required_date,
       case when g.code = 'Shipment' and o.shipping_method = 'Monterrey → Customer' then now() else null end
from public.preppap_orders o
cross join (values
  ('Quote',          'Cotización Metrics Mexico → Customer',                            'Metrics Mexico', 'Customer'),
  ('CustomerPO',     'PO Customer → Metrics Mexico',                                    'Customer',       'Metrics Mexico'),
  ('PrePPAPRequest', 'PrePPAP Order Request',                                           'MWS',            'MES'),
  ('MESPO',          'PO Metrics México → Metrics Works',                               'Metrics México', 'Metrics Works'),
  ('MWSInvoice',     'Invoice Metrics Works → Metrics México',                          'Metrics Works',  'Metrics México'),
  ('Shipment',       'Metrics Mexico Shipment Process / Metrics Works Shipment Process','Metrics Mexico', 'Customer'),
  ('MESInvoice',     'Invoice Metrics México → Customer',                               'Metrics México', 'Customer')
) as g(code, name, from_party, to_party)
where not exists (select 1 from public.preppap_tasks t where t.order_id = o.id and t.task_code = g.code);

notify pgrst, 'reload schema';
