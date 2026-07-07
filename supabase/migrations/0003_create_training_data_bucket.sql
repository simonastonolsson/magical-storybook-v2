-- Private bucket for LoRA training zips, replacing tmpfiles.org.
-- Files are stored under "<user_id>/training-<timestamp>.zip". Unlike
-- reference-images, this bucket is NOT public: training photos are more
-- sensitive, so Replicate is instead given a short-lived signed URL
-- (see app/api/upload-training-data/route.ts).
insert into storage.buckets (id, name, public)
values ('training-data', 'training-data', false)
on conflict (id) do nothing;

create policy "Users can upload to their own training-data folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'training-data'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read their own training data"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'training-data'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own training data"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-data'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
