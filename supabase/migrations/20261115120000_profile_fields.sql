-- Profile fields for the Spontys app: a handle, a bio, social links, a badge and a private birthday, plus a public bucket for profile photos.
-- Reading and changing these goes through the backend (it checks who is asking). The website itself still may only edit name, photo and city.

alter table public.profiles
  add column handle     text,
  add column bio        text,
  add column instagram  text,
  add column youtube    text,
  add column x_handle   text,
  add column badge      text not null default 'vibes',
  add column birthday   date;

alter table public.profiles
  add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_.]{3,30}$'),
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 200),
  add constraint profiles_instagram_format check (instagram is null or instagram ~ '^[A-Za-z0-9_.]{1,40}$'),
  add constraint profiles_youtube_format check (youtube is null or youtube ~ '^[A-Za-z0-9_.@-]{1,60}$'),
  add constraint profiles_x_format check (x_handle is null or x_handle ~ '^[A-Za-z0-9_]{1,40}$'),
  -- exclusive and pro are given by the PB&J team after checking; a person can pick vibes, sponty or newbie themselves (the backend enforces that)
  add constraint profiles_badge_values check (badge in ('vibes', 'sponty', 'newbie', 'pro', 'exclusive'));

-- One handle per person, ignoring capitals
create unique index profiles_handle_key on public.profiles (lower(handle)) where handle is not null;

-- Profile photos: anyone can see them, each person can only add or change files in their own folder (the folder name is their id)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars are public" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "add own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "change own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "remove own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
