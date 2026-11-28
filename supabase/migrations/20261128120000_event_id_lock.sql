-- Hosts save their events straight through Supabase. They could rename an event's id, which carried a staff "hidden"
-- mark away to the renamed row so the original link could be made again, fresh and visible. They could also backdate
-- created_at, which orders the back office's "to review" list. Now neither can change from the website: the id is
-- fixed once an event exists, and created_at is set by the database. (Staff, through the backend, are unaffected.)
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
      new.reviewed_at := old.reviewed_at; new.hidden_at := old.hidden_at; new.hidden_reason := old.hidden_reason;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;
