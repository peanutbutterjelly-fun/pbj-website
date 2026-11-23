-- What lives on a profile besides the basics: who you follow, how you reacted to events, your saved lists, events you went to, and host recaps.
-- Only the backend writes to these tables (it checks who is asking). The website may READ what a person is allowed to see.
--   follows        who follows whom. Counts are public, so any signed-in person can read them.
--   reactions      Love / Like / Curious on an event. Private to the person.
--   saved_lists    a person's named lists (Saved, Weekend, ...). Private.
--   saved_items    events inside those lists. Private.
--   attendances    "I went": a mood and a short note. Who can see it follows the person's own privacy choice.
--   event_recaps   what a host writes after their event, with photos. Public once the event is published.

-- Who can see the events a person went to. Default is followers only (open question 8 in LAUNCH-MAP.md; change the default here if the owner decides otherwise).
alter table public.profiles
  add column attended_visibility text not null default 'followers'
    check (attended_visibility in ('public', 'followers', 'private'));

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.reactions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  kind       text not null check (kind in ('love', 'like', 'curious')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index reactions_event_idx on public.reactions (event_id);

create table public.saved_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.saved_items (
  list_id    uuid not null references public.saved_lists (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, event_id)
);
create index saved_items_event_idx on public.saved_items (event_id);

create table public.attendances (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  mood       text check (mood is null or mood in ('loved', 'good', 'okay', 'meh')),
  note       text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index attendances_event_idx on public.attendances (event_id);

create table public.event_recaps (
  event_id   uuid primary key references public.events (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  photos     text[] not null default '{}' check (cardinality(photos) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger event_recaps_set_updated_at before update on public.event_recaps for each row execute function public.set_updated_at();

-- Can the signed-in person see this person's attended list? Yourself always; otherwise it depends on their privacy choice.
create or replace function public.can_see_attended(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = owner
    or exists (
      select 1 from public.profiles p
      where p.id = owner
        and (p.attended_visibility = 'public'
          or (p.attended_visibility = 'followers'
              and exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = owner)))
    );
$$;

alter table public.follows      enable row level security;
alter table public.reactions    enable row level security;
alter table public.saved_lists  enable row level security;
alter table public.saved_items  enable row level security;
alter table public.attendances  enable row level security;
alter table public.event_recaps enable row level security;

create policy "read follows" on public.follows for select to authenticated using (true);
create policy "read own reactions" on public.reactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own lists" on public.saved_lists for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own saved items" on public.saved_items for select to authenticated
  using (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = (select auth.uid())));
create policy "read allowed attendances" on public.attendances for select to authenticated using (public.can_see_attended(user_id));
create policy "read recaps of published events" on public.event_recaps for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));

-- Writes go through the backend only.
revoke all on public.follows, public.reactions, public.saved_lists, public.saved_items, public.attendances, public.event_recaps from anon, authenticated;
grant select on public.follows, public.reactions, public.saved_lists, public.saved_items, public.attendances, public.event_recaps to authenticated;
