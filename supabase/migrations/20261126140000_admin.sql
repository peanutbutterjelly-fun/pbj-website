-- What the PB&J back office (the staff-only admin screen) needs. Only the backend reads and writes these, after checking
-- the admin login; the website's own Supabase connection can at most read the public picks (featured).
--   profiles.verified_at   staff checked this person's identity by hand (until a third-party check is connected)
--   events.reviewed_at     staff looked at this event and it's fine
--   events.hidden_at       staff took this event off the site (with a reason). Its host still sees it in the dashboard.
--   featured               PB&J's picks: the "What you missed" highlights and the "Lists for you" on Spontys
--   reports                what members flag (an event, a person, a chat or a message), for staff to look at
--   broadcasts             announcements staff write to everyone (sent once real notifications exist, see issue #31)

alter table public.profiles add column verified_at timestamptz;

alter table public.events
  add column reviewed_at   timestamptz,
  add column hidden_at     timestamptz,
  add column hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 300);

create index events_unreviewed_idx on public.events (created_at) where reviewed_at is null;

-- Hosts save their events straight through Supabase, so they could otherwise set these themselves:
-- only staff (through the backend) can change them.
create or replace function public.keep_staff_event_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.reviewed_at := null; new.hidden_at := null; new.hidden_reason := null;
    else
      new.reviewed_at := old.reviewed_at; new.hidden_at := old.hidden_at; new.hidden_reason := old.hidden_reason;
    end if;
  end if;
  return new;
end;
$$;

create trigger events_keep_staff_fields
  before insert or update on public.events
  for each row execute function public.keep_staff_event_fields();

-- A hidden event drops off the Events page and its public link. Its host (and people already holding a ticket) still see it.
drop policy "anyone sees listed events" on public.events;
create policy "anyone sees listed events" on public.events
  for select to anon, authenticated
  using (status <> 'draft' and hidden_at is null);

-- ...and its host can't delete it either (deleting and saving it again would clear the staff's "hidden" mark).
-- Staff can still delete it from the back office.
drop policy "hosts delete their own events" on public.events;
create policy "hosts delete their own events" on public.events
  for delete to authenticated
  using ((select auth.uid()) = host_id and hidden_at is null);

create table public.featured (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('highlight', 'list')),
  title       text not null check (char_length(title) between 1 and 80),
  subtitle    text check (subtitle is null or char_length(subtitle) <= 160),
  query       text check (query is null or char_length(query) <= 120), -- a list's search words, e.g. "pottery bandra"
  event_ids   text[] not null default '{}' check (cardinality(event_ids) <= 40),
  position    int not null default 0,
  live        boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index featured_kind_position_idx on public.featured (kind, position);
create trigger featured_set_updated_at before update on public.featured for each row execute function public.set_updated_at();

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.profiles (id) on delete set null,
  target_kind  text not null check (target_kind in ('event', 'person', 'chat', 'message')),
  target_id    text not null check (char_length(target_id) between 1 and 80),
  reason       text not null check (char_length(reason) between 1 and 80),
  note         text check (note is null or char_length(note) <= 1000),
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);

create table public.broadcasts (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null default 'everyone' check (audience in ('everyone', 'hosts', 'members')),
  title       text not null check (char_length(title) between 1 and 80),
  body        text not null check (char_length(body) between 1 and 600 and btrim(body) <> ''),
  created_at  timestamptz not null default now()
);

alter table public.featured enable row level security;
alter table public.reports enable row level security;
alter table public.broadcasts enable row level security;

-- Anyone may read the picks that are live (they're shown to everyone); nobody on the website may write them.
create policy "anyone reads live picks" on public.featured for select to anon, authenticated using (live);
revoke all on public.featured, public.reports, public.broadcasts from anon, authenticated;
grant select on public.featured to anon, authenticated;
