-- GUVEL PrePPAP / CLEAN START
-- DESTRUCTIVE: removes ALL PrePPAP orders, tasks, compensations, documents
-- and ALL files from the PrePPAP Storage bucket.
-- Run ONLY once if the current project contains demo/test data you want removed.

delete from public.preppap_orders;
delete from storage.objects where bucket_id = 'preppap-documents';

-- The bucket remains configured at 50 KB.
update storage.buckets
set file_size_limit = 51200
where id = 'preppap-documents';
