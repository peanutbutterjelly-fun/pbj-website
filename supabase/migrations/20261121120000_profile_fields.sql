-- Profile fields for the Spontys app: a handle, social links, a badge and a private birthday.
-- The short "about me" text is the existing `about` column, and profile photos live in the existing `images` bucket
-- (images/<account id>/profile/...), so this adds no second text field and no second photo bucket.
-- Reading and changing these goes through the backend (it checks who is asking). The website can't write them directly.

alter table public.profiles
  add column handle     text,
  add column instagram  text,
  add column youtube    text,
  add column x_handle   text,
  add column badge      text not null default 'vibes',
  add column birthday   date;

alter table public.profiles
  add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_.]{3,30}$'),
  add constraint profiles_instagram_format check (instagram is null or instagram ~ '^[A-Za-z0-9_.]{1,40}$'),
  add constraint profiles_youtube_format check (youtube is null or youtube ~ '^[A-Za-z0-9_.@-]{1,60}$'),
  add constraint profiles_x_format check (x_handle is null or x_handle ~ '^[A-Za-z0-9_]{1,40}$'),
  -- exclusive and pro are given by the PB&J team after checking; a person can pick vibes, sponty or newbie themselves (the backend enforces that)
  add constraint profiles_badge_values check (badge in ('vibes', 'sponty', 'newbie', 'pro', 'exclusive')),
  -- the backend also refuses birthdays in the future
  add constraint profiles_birthday_range check (birthday is null or birthday >= date '1900-01-01');

-- One handle per person, ignoring capitals
create unique index profiles_handle_key on public.profiles (lower(handle)) where handle is not null;
