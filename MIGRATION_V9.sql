-- GUVEL PrePPAP V9
-- Safe migration: preserves existing orders, tasks, documents and compensation history.

-- 1) Increase evidence limit from 50 KB to 2 MB.
alter table public.preppap_documents drop constraint if exists preppap_documents_size_bytes_check;
alter table public.preppap_documents add constraint preppap_documents_size_bytes_check
  check (size_bytes is null or size_bytes <= 2097152);

-- Supabase Storage bucket limit.
update storage.buckets
set file_size_limit = 2097152
where id = 'preppap-documents';

-- 2) Ensure task evidence fields exist.
alter table public.preppap_tasks add column if not exists reference text;
alter table public.preppap_tasks add column if not exists details text;

-- 3) New seven-step workflow. Old Shipping/FedEx/Monterrey task rows are retained
-- for historical traceability, but are no longer part of the active UI workflow.
-- Add the new Shipment task to existing orders that do not have it.
insert into public.preppap_tasks (order_id, task_code, task_name, from_party, to_party, status, due_date, completed_at)
select o.id,
       'Shipment',
       'Metrics Mexico Shipment Process / Metrics Works Shipment Process',
       'Metrics Mexico',
       'Customer',
       case when o.shipping_method = 'Monterrey → Customer' then 'Completed' else 'Not Started' end,
       o.required_date,
       case when o.shipping_method = 'Monterrey → Customer' then now() else null end
from public.preppap_orders o
where not exists (
  select 1 from public.preppap_tasks t
  where t.order_id=o.id and t.task_code='Shipment'
);

-- 4) Keep the workflow trigger compatible with the new task codes.
create or replace function public.enforce_preppap_task_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  evidence_count integer;
  evidence_task_code text;
  shipping_method text;
begin
  if new.status = 'Completed' then
    select shipping_method into shipping_method from public.preppap_orders where id=new.order_id;
    if new.task_code = 'Shipment' and shipping_method = 'Monterrey → Customer' then
      return new;
    end if;

    evidence_task_code := case new.task_code
      when 'Quote' then '01_Cotizacion_Metrics_Mexico_Customer'
      when 'CustomerPO' then '02_PO_Customer_Metrics_Mexico'
      when 'PrePPAPRequest' then '03_PrePPAP_Order_Request'
      when 'MESPO' then '04_PO_Metrics_Mexico_Metrics_Works'
      when 'MWSInvoice' then '05_Invoice_Metrics_Works_Metrics_Mexico'
      when 'Shipment' then '06_Shipment_Process'
      when 'MESInvoice' then '07_Invoice_Metrics_Mexico_Customer'
      else new.task_code
    end;

    select count(*) into evidence_count
    from public.preppap_documents
    where order_id=new.order_id and task_code=evidence_task_code;

    if evidence_count = 0 then
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

notify pgrst, 'reload schema';
