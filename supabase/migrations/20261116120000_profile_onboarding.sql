-- The welcome steps after signing in: who you are, how to reach you, and whether you'd like a call with us.
-- onboarded_at stays empty until someone finishes those steps; the dashboard asks for them until then.

alter table public.profiles
  add column phone        text check (char_length(phone) <= 40),
  add column host_kind    text check (char_length(host_kind) <= 80),
  add column link         text check (char_length(link) <= 300),
  add column about        text check (char_length(about) <= 600),
  add column wants_call   boolean not null default false,
  add column onboarded_at timestamptz;

-- People can fill these in themselves (role and onboarded_at still can't be changed directly: the server sets
-- onboarded_at, and only once a name and "who are you" are filled in)
grant update (phone, host_kind, link, about, wants_call) on public.profiles to authenticated;

-- Sign-ups and forms sent while signed in are linked to that person's account
alter table public.leads
  add column user_id uuid references auth.users (id) on delete set null;

create index leads_user_id_idx on public.leads (user_id);

-- Signed-out visitors can still only add rows, without an account attached.
-- Signed-in people can attach only their own account.
drop policy if exists "anyone can add a lead" on public.leads;

create policy "visitors add a lead" on public.leads
  for insert to anon with check (user_id is null);

create policy "signed-in people add their own lead" on public.leads
  for insert to authenticated with check (user_id is null or user_id = (select auth.uid()));
