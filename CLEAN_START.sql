-- GUVEL PrePPAP / CLEAN START V4
-- Removes PrePPAP database records, but intentionally does NOT touch storage.objects.
-- Supabase blocks direct SQL deletion from storage.objects.
-- After running this file, open CLEAN_STORAGE.html and sign in to remove the
-- corresponding files through the official Storage API.

begin;

delete from public.preppap_documents;
delete from public.preppap_compensations;
delete from public.preppap_tasks;
delete from public.preppap_orders;

update storage.buckets
set file_size_limit = 51200
where id = 'preppap-documents';

commit;

notify pgrst, 'reload schema';
