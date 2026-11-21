-- Free tickets (RSVPs) and each event's group chat, for the events hosts already make in the dashboard (public.events).
-- Only the backend writes to these tables (it checks who is asking). The website may only READ what a person is allowed
-- to see, which also lets chat messages arrive live (Supabase Realtime respects these read rules).
--   tickets        who asked for, or holds, a ticket. For a Sponty event (data.type = 'guestlist') a person first REQUESTS
--                  and the host accepts or declines; other events give the ticket at once. People see only their own.
--   chats          one group chat per event, opened when the first guest gets in. Only its host posts updates.
--   chat_members   who is in which chat (the host, and everyone going).
--   messages       the updates and notices in a chat. Only members of that chat can read them.

create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- requested: waiting for the host. going: has the ticket (takes a spot). declined: host said no. cancelled: the person left.
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
  event_id    text not null unique references public.events (id) on delete cascade,
  -- the one person who posts updates: the event's host
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
  body        text not null check (char_length(body) between 1 and 600 and btrim(body) <> ''),
  created_at  timestamptz not null default now()
);
create index messages_chat_id_id_idx on public.messages (chat_id, id);
create index messages_sender_id_idx on public.messages (sender_id);

-- Who can READ what. There are no insert, update or delete rules: the website can't write to these tables at all.
alter table public.tickets enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

create policy "people see their own tickets" on public.tickets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "people see their own memberships" on public.chat_members
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "members see their chats" on public.chats
  for select to authenticated
  using (exists (select 1 from public.chat_members m where m.chat_id = chats.id and m.user_id = (select auth.uid())));
create policy "members see their chat's messages" on public.messages
  for select to authenticated
  using (exists (select 1 from public.chat_members m where m.chat_id = messages.chat_id and m.user_id = (select auth.uid())));

revoke all on public.tickets, public.chats, public.chat_members, public.messages from anon, authenticated;
grant select on public.tickets, public.chats, public.chat_members, public.messages to authenticated;

-- Someone with a ticket (or a request) can still open that event even if the host turns it back into a draft.
-- (Cancelled events are already readable by anyone with the link.)
create policy "ticket holders see their events" on public.events
  for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.event_id = events.id and t.user_id = (select auth.uid()) and t.status in ('requested', 'going')
  ));

-- When a host cancels an event in the dashboard, its group chat is told.
create or replace function public.tell_chat_event_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.messages (chat_id, sender_id, kind, body)
  select c.id, new.host_id, 'system', 'This event was cancelled by the host.'
  from public.chats c where c.event_id = new.id;
  return new;
end;
$$;
revoke execute on function public.tell_chat_event_cancelled() from public, anon, authenticated;

create trigger events_tell_chat_cancelled
  after update of status on public.events
  for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.tell_chat_event_cancelled();

-- New messages reach open chats live
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
