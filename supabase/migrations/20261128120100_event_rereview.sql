-- A host could get an event reviewed, then swap in a different title, description or photos and it stayed "reviewed".
-- Now any change a host makes to what guests see (the event's details, status or dates) sends it back to the back
-- office's "to review" list. Staff-hidden events stay hidden whatever the host changes.
create or replace function public.keep_staff_event_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.reviewed_at := null; new.hidden_at := null; new.hidden_reason := null;
      new.created_at := now();
    else
      if new.id is distinct from old.id then
        raise exception 'An event''s id can''t be changed' using errcode = '42501';
      end if;
      new.hidden_at := old.hidden_at; new.hidden_reason := old.hidden_reason;
      new.created_at := old.created_at;
      if (new.data, new.status, new.starts_on, new.ends_on) is distinct from (old.data, old.status, old.starts_on, old.ends_on) then
        new.reviewed_at := null;  -- changed after review: staff look again
      else
        new.reviewed_at := old.reviewed_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;
