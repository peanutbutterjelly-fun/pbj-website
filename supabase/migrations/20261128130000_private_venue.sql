-- "Exact location shared after booking" (women-only events, or the host ticked "hide location") only hid the address on
-- screen: the venue, address and map pin were still in the public event, readable by anyone. Now, whenever such an event is
-- saved, the database moves those four fields into the host-only private half (event_private.data.venue), whatever the
-- website sends. Booked guests get them from the backend (GET /api/events/<id>/venue). venueStatus stays public.

create or replace function public.move_hidden_venue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields constant text[] := array['venue', 'venueAddress', 'venueLat', 'venueLon'];
begin
  if (coalesce(new.data->>'womenOnly', '') = 'true' or coalesce(new.data->>'hideLocation', '') = 'true')
     and new.data ?| fields then
    insert into public.event_private (event_id, host_id, data)
    values (new.id, new.host_id, jsonb_build_object('venue', jsonb_strip_nulls(jsonb_build_object(
      'venue', new.data->'venue', 'venueAddress', new.data->'venueAddress',
      'venueLat', new.data->'venueLat', 'venueLon', new.data->'venueLon'))))
    on conflict (event_id) do update set data = public.event_private.data || jsonb_build_object('venue', excluded.data->'venue');
    update public.events set data = data - fields where id = new.id;
  end if;
  return null;
end;
$$;
revoke execute on function public.move_hidden_venue() from public, anon, authenticated;

create trigger events_move_hidden_venue
  after insert or update of data on public.events
  for each row execute function public.move_hidden_venue();

-- The website saves the private half after the event, sending only what it knows. Keep a moved venue when that save
-- doesn't include one (an older copy of the dashboard), so the host never loses the address.
create or replace function public.keep_private_venue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.data ? 'venue' and not (new.data ? 'venue') then
    new.data := new.data || jsonb_build_object('venue', old.data->'venue');
  end if;
  return new;
end;
$$;

create trigger event_private_keep_venue
  before update on public.event_private
  for each row execute function public.keep_private_venue();

-- Events already saved with a hidden location: move their address now
update public.events set data = data
where coalesce(data->>'womenOnly', '') = 'true' or coalesce(data->>'hideLocation', '') = 'true';
