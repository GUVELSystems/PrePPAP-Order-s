-- GUVEL PrePPAP — REINICIO DE DATOS (DESTRUCTIVO)
-- Borra TODAS las órdenes, etapas, documentos y balances de la base de datos.
-- No toca Storage (Supabase bloquea el DELETE directo en storage.objects):
-- después abre tools/clean-storage.html para borrar los archivos por la API.
--
-- Úsalo solo para dejar el sistema en cero. NO lo ejecutes en una actualización normal.

begin;

delete from public.preppap_documents;
delete from public.preppap_compensations;
delete from public.preppap_tasks;
delete from public.preppap_orders;

-- (la versión original dejaba el límite en 50 KB; el correcto es 2 MB)
update storage.buckets set file_size_limit = 2097152 where id = 'preppap-documents';

commit;

notify pgrst, 'reload schema';
