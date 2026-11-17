-- Events, free tickets (RSVPs) and group chats.
-- Only the backend writes to these tables (it checks who is asking). The website may READ what a person is allowed to see, which
-- also lets chat messages arrive live (Supabase Realtime respects these read rules).
--   events         what hosts list. Anyone can see a published event; a host also sees their own drafts.
--   tickets        who asked for, or holds, a ticket. For a Sponty plan a person first REQUESTS; the planner accepts or declines.
--                  People see only their own.
--   chats          one group chat per event. Only its host posts updates in it.
--   chat_members   who is in which chat (the host, and everyone with a ticket).
--   messages       the updates and system lines in a chat. Only members of that chat can read them.

-- A one-time identity check by a third-party service is required to list or join a Sponty plan (safety). Until that service is connected the team
-- sets verified_at by hand. The ID documents themselves are never kept here, only that the check passed and the provider's reference.
alter table public.profiles
  add column verified_at timestamptz,
  add column verification_ref text check (verification_ref is null or char_length(verification_ref) <= 200);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.profiles (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
  title       text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 2000),
  category    text check (category is null or char_length(category) <= 40),
  city        text not null default 'Mumbai' check (char_length(city) <= 80),
  area        text check (area is null or char_length(area) <= 80),
  venue       text check (venue is null or char_length(venue) <= 120),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  capacity    integer check (capacity is null or capacity between 1 and 100000),
  -- the host dashboard's event types: sponty (free), exclusive, open. Only free tickets exist for now.
  kind        text not null default 'sponty' check (kind in ('sponty', 'exclusive', 'open')),
  -- Sponty plans: the planner approves each person (manual, the default, for safety) or lets the first people in (auto). Other kinds ignore this.
  approval    text not null default 'manual' check (approval in ('manual', 'auto')),
  cover_url   text check (cover_url is null or char_length(cover_url) <= 500),
  status      text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at is null or ends_at > starts_at)
);
create index events_host_id_idx on public.events (host_id);
create index events_published_starts_at_idx on public.events (starts_at) where status = 'published';
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- requested: waiting for the planner. going: has the ticket (counts against the spots). declined: planner said no. cancelled: person left.
  status      text not null default 'going' check (status in ('requested', 'going', 'declined', 'cancelled')),
  note        text check (note is null or char_length(note) <= 140),
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_id, user_id)
);
create index tickets_user_id_idx on public.tickets (user_id);
create index tickets_event_status_idx on public.tickets (event_id, status);
create trigger tickets_set_updated_at before update on public.tickets for each row execute function public.set_updated_at();

create table public.chats (
  id          uuid primary key default gen_random_uuid(),
  -- one chat per event. Plans (sponty planners) get their own chats later, so this can be empty.
  event_id    uuid unique references public.events (id) on delete cascade,
  kind        text not null default 'event' check (kind in ('event', 'plan')),
  -- the one person who posts updates: the host (or the planner)
  host_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now()
);
create index chats_host_id_idx on public.chats (host_id);

create table public.chat_members (
  chat_id       uuid not null references public.chats (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member' check (role in ('host', 'member')),
  joined_at     timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user_id_idx on public.chat_members (user_id);

create table public.messages (
  id          bigint generated always as identity primary key,
  chat_id     uuid not null references public.chats (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'update' check (kind in ('update', 'system')),
  body        text not null check (char_length(body) between 1 and 600),
  created_at  timestamptz not null default now()
);
create index messages_chat_id_id_idx on public.messages (chat_id, id);

-- Who can READ what (writes all go through the backend, so no insert/update/delete policies)
alter table public.events enable row level security;
alter table public.tickets enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

create policy "anyone sees published events" on public.events
  for select to anon, authenticated using (status = 'published');
create policy "hosts see their own events" on public.events
  for select to authenticated using ((select auth.uid()) = host_id);
create policy "people see their own tickets" on public.tickets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "people see their own memberships" on public.chat_members
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "members see their chats" on public.chats
  for select to authenticated using (exists (select 1 from public.chat_members m where m.chat_id = chats.id and m.user_id = (select auth.uid())));
create policy "members see their chat's messages" on public.messages
  for select to authenticated using (exists (select 1 from public.chat_members m where m.chat_id = messages.chat_id and m.user_id = (select auth.uid())));

revoke insert, update, delete on public.events, public.tickets, public.chats, public.chat_members, public.messages from anon, authenticated;
revoke all on public.tickets, public.chats, public.chat_members, public.messages from anon;

-- New messages reach open chats live
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
