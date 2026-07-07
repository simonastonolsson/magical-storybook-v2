-- Public bucket for character reference photos, replacing Vercel Blob.
-- Files are stored under "<user_id>/reference-<timestamp>.jpg" so RLS can
-- restrict writes to each user's own folder while reads stay public (the
-- reference image URL is passed to Replicate, which needs to fetch it).
insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', true)
on conflict (id) do nothing;

create policy "Users can upload to their own reference-images folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own reference images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own reference images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Reference images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'reference-images');
