-- Photos people add on the site (event covers, logos, pictures in descriptions, profile photos).
-- Stored in Supabase Storage, in an "images" folder anyone can view by its link (events are public).
-- Each person can only add or remove files inside their own folder: images/<their account id>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']) -- 5 MB each
on conflict (id) do nothing;

create policy "people add images to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "people remove images from their own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);
