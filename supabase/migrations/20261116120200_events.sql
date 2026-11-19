-- Events made in the host dashboard. Each event is split in two:
--   events         what guests see (title, dates, place, tickets, photos...). Anyone can read it once it's listed.
--   event_private  what only the host sees (organizers' bank, PAN, GST, email and phone; discount coupons).
-- Only the host who made an event can add, change or delete it. Drafts stay private to the host.

create table public.events (
  id          text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  host_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status      text not null default 'draft' check (status in ('draft', 'published', 'coming', 'soldout', 'cancelled')),
  starts_on   date,
  ends_on     date,     -- the last day; the Events page hides an event once this has passed
  data        jsonb not null default '{}' check (octet_length(data::text) <= 500000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index events_host_id_idx on public.events (host_id);
create index events_listed_idx on public.events (status, ends_on);

create table public.event_private (
  event_id    text primary key references public.events (id) on delete cascade,
  host_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null default '{}' check (octet_length(data::text) <= 100000),
  updated_at  timestamptz not null default now()
);

create index event_private_host_id_idx on public.event_private (host_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create trigger event_private_set_updated_at
  before update on public.event_private
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.event_private enable row level security;

-- Everyone (signed in or not) can see listed events; hosts also see their own drafts
create policy "anyone sees listed events" on public.events
  for select to anon, authenticated
  using (status <> 'draft');

create policy "hosts see their own events" on public.events
  for select to authenticated
  using ((select auth.uid()) = host_id);

create policy "hosts add their own events" on public.events
  for insert to authenticated
  with check ((select auth.uid()) = host_id);

create policy "hosts change their own events" on public.events
  for update to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

create policy "hosts delete their own events" on public.events
  for delete to authenticated
  using ((select auth.uid()) = host_id);

-- The private half: only the host, and only for their own event
create policy "hosts see their own private details" on public.event_private
  for select to authenticated
  using ((select auth.uid()) = host_id);

create policy "hosts add their own private details" on public.event_private
  for insert to authenticated
  with check (
    (select auth.uid()) = host_id
    and exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid()))
  );

create policy "hosts change their own private details" on public.event_private
  for update to authenticated
  using ((select auth.uid()) = host_id)
  with check (
    (select auth.uid()) = host_id
    and exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid()))
  );

create policy "hosts delete their own private details" on public.event_private
  for delete to authenticated
  using ((select auth.uid()) = host_id);

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_private to authenticated;
revoke all on public.event_private from anon;
