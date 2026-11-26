"""Who can read and change what, checked in a real (throwaway) Postgres with every migration applied (the `pg` fixture).
These are the database's own rules, the ones that still hold if someone skips the website and talks to Supabase directly:
events and their private half, the sign-up forms, photos, a Sponty event's guests, and what a profile shows to others.
(Tickets and chats have their own checks in test_events_chats.py.)"""

import uuid

import pytest

psycopg = pytest.importorskip("psycopg")
Refused = psycopg.errors.InsufficientPrivilege  # also what Postgres raises when a row breaks a row-level security rule


MAIL = "@access-rules.test"  # every sign-up form these tests send, so they can be cleared away afterwards


@pytest.fixture
def conn(pg):
    """A connection to the test database. Everyone and everything a test makes is removed afterwards
    (deleting a person takes their events, tickets and lists with them), so other test files never count it."""
    with psycopg.connect(pg, autocommit=True) as c:
        c.people = []
        yield c
        c.execute("reset role")
        for uid in c.people:
            c.execute("delete from storage.objects where name like %s", (f"{uid}/%",))
        c.execute("delete from auth.users where id = any(%s)", (c.people,))
        c.execute("delete from public.leads where email like %s", (f"%{MAIL}",))


def person(conn) -> uuid.UUID:
    uid = uuid.uuid4()
    conn.execute("insert into auth.users (id, email) values (%s, %s)", (uid, f"{uid}@x.com"))
    conn.people.append(uid)
    return uid


def as_person(conn, uid):
    conn.execute("reset role")
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid),))


def as_visitor(conn):
    """Someone on the website who isn't signed in."""
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claim.sub', '', false)")
    conn.execute("set role anon")


def new_id(prefix="e") -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def host_event(conn, host, status="published", private='{"organizers": [{"pan": "ABCDE1234F", "account": "123456789"}]}'):
    """An event and its private half, saved by its host the way the dashboard saves them."""
    eid = new_id()
    as_person(conn, host)
    conn.execute("insert into public.events (id, status, data) values (%s, %s, '{\"title\": \"Clay and Chai\"}')", (eid, status))
    conn.execute("insert into public.event_private (event_id, data) values (%s, %s::jsonb)", (eid, private))
    conn.execute("reset role")
    return eid


def count(conn, sql, *args) -> int:
    return conn.execute(f"select count(*) from {sql}", args).fetchone()[0]


# ---- events ----

def test_visitors_see_listed_events_but_never_drafts(conn):
    host, stranger = person(conn), person(conn)
    listed, draft = host_event(conn, host), host_event(conn, host, status="draft")
    try:
        as_visitor(conn)
        assert count(conn, "public.events where id = %s", listed) == 1
        assert count(conn, "public.events where id = %s", draft) == 0
        as_person(conn, stranger)  # signed in, but not the host
        assert count(conn, "public.events where id = %s", draft) == 0
        as_person(conn, host)
        assert count(conn, "public.events where id = %s", draft) == 1  # the host sees their own draft
    finally:
        conn.execute("reset role")


def test_visitors_cannot_add_change_or_delete_events(conn):
    eid = host_event(conn, person(conn))
    try:
        as_visitor(conn)
        with pytest.raises(Refused):
            conn.execute("insert into public.events (id, data) values ('ehacked1', '{}')")
        # changing or deleting isn't an error: the rules just find no event the visitor may touch
        assert conn.execute("update public.events set status = 'cancelled' where id = %s", (eid,)).rowcount == 0
        assert conn.execute("delete from public.events where id = %s", (eid,)).rowcount == 0
    finally:
        conn.execute("reset role")
    assert conn.execute("select status from public.events where id = %s", (eid,)).fetchone()[0] == "published"


def test_one_host_cannot_change_or_delete_another_hosts_event(conn):
    host, other = person(conn), person(conn)
    eid = host_event(conn, host)
    try:
        as_person(conn, other)
        assert conn.execute("update public.events set data = '{\"title\": \"Hacked\"}' where id = %s", (eid,)).rowcount == 0
        assert conn.execute("delete from public.events where id = %s", (eid,)).rowcount == 0
        with pytest.raises(Refused):  # nor make an event in someone else's name
            conn.execute("insert into public.events (id, host_id, data) values (%s, %s, '{}')", (new_id(), host))
    finally:
        conn.execute("reset role")
    assert conn.execute("select data->>'title' from public.events where id = %s", (eid,)).fetchone()[0] == "Clay and Chai"


def test_a_host_cannot_give_their_event_to_someone_else(conn):
    host, other = person(conn), person(conn)
    eid = host_event(conn, host)
    try:
        as_person(conn, host)
        with pytest.raises(Refused):
            conn.execute("update public.events set host_id = %s where id = %s", (other, eid))
    finally:
        conn.execute("reset role")


# ---- the private half: bank, PAN and contact details, coupons ----

def test_private_details_are_for_the_host_only(conn):
    host, other = person(conn), person(conn)
    eid = host_event(conn, host)
    try:
        as_visitor(conn)
        with pytest.raises(Refused):
            conn.execute("select 1 from public.event_private")
        as_person(conn, other)
        assert count(conn, "public.event_private where event_id = %s", eid) == 0
        assert conn.execute("update public.event_private set data = '{}' where event_id = %s", (eid,)).rowcount == 0
        assert conn.execute("delete from public.event_private where event_id = %s", (eid,)).rowcount == 0
        as_person(conn, host)
        assert conn.execute("select data->'organizers'->0->>'pan' from public.event_private where event_id = %s", (eid,)).fetchone()[0] == "ABCDE1234F"
    finally:
        conn.execute("reset role")


def test_nobody_can_attach_private_details_to_someone_elses_event(conn):
    host, other = person(conn), person(conn)
    as_person(conn, host)
    eid = new_id()
    conn.execute("insert into public.events (id, status) values (%s, 'published')", (eid,))  # no private half yet
    try:
        as_person(conn, other)
        with pytest.raises(Refused):  # e.g. to swap in their own bank account
            conn.execute("insert into public.event_private (event_id, data) values (%s, '{\"organizers\": [{\"account\": \"999\"}]}')", (eid,))
    finally:
        conn.execute("reset role")
    assert count(conn, "public.event_private where event_id = %s", eid) == 0


# ---- the List Your Event forms ----

def test_sign_up_forms_can_be_sent_but_never_read_back(conn):
    member = person(conn)
    try:
        as_visitor(conn)
        conn.execute("insert into public.leads (kind, name, email) values ('signup', 'Asha', %s)", (f"asha{MAIL}",))
        for who in ("visitor", "signed in"):  # signed in makes no difference
            if who == "signed in":
                as_person(conn, member)
            assert count(conn, "public.leads") == 0, who  # not even the form they just sent
            assert conn.execute("update public.leads set name = 'x'").rowcount == 0, who
            assert conn.execute("delete from public.leads").rowcount == 0, who
    finally:
        conn.execute("reset role")
    assert conn.execute("select name from public.leads where email = %s", (f"asha{MAIL}",)).fetchone()[0] == "Asha"


# ---- photos (the images folder) ----

def test_people_add_and_remove_photos_only_in_their_own_folder(conn):
    asha, ravi = person(conn), person(conn)
    conn.execute("insert into storage.objects (bucket_id, name) values ('images', %s)", (f"{ravi}/events/cover.jpg",))
    try:
        as_person(conn, asha)
        conn.execute("insert into storage.objects (bucket_id, name) values ('images', %s)", (f"{asha}/profile/me.jpg",))
        for folder in (f"{ravi}/profile/me.jpg", "profile/me.jpg", f"x/{asha}/me.jpg"):
            with pytest.raises(Refused):
                conn.execute("insert into storage.objects (bucket_id, name) values ('images', %s)", (folder,))
        with pytest.raises(Refused):  # only the images folder
            conn.execute("insert into storage.objects (bucket_id, name) values ('other', %s)", (f"{asha}/a.jpg",))
        assert count(conn, "storage.objects where name like %s", f"{ravi}/%") == 0  # can't even list someone else's files
        assert conn.execute("delete from storage.objects where name like %s", (f"{ravi}/%",)).rowcount == 0
        as_visitor(conn)
        with pytest.raises(Refused):
            conn.execute("insert into storage.objects (bucket_id, name) values ('images', %s)", (f"{asha}/b.jpg",))
    finally:
        conn.execute("reset role")
    assert count(conn, "storage.objects where name = %s", f"{ravi}/events/cover.jpg") == 1


# ---- a Sponty event's guests ----

def test_a_sponty_events_guests_stay_private_and_a_declined_guest_loses_the_draft(conn):
    planner, asha, ravi, stranger = (person(conn) for _ in range(4))
    eid = host_event(conn, planner, private="{}")
    conn.execute("update public.events set data = '{\"type\": \"guestlist\"}' where id = %s", (eid,))
    conn.execute("insert into public.tickets (event_id, user_id, status, note) values (%s, %s, 'requested', 'Can I bring a friend?'), "
                 "(%s, %s, 'declined', null)", (eid, asha, eid, ravi))
    conn.execute("update public.events set status = 'draft' where id = %s", (eid,))  # the planner takes it down
    try:
        as_person(conn, asha)
        assert count(conn, "public.tickets where event_id = %s", eid) == 1  # only her own request, never the others'
        assert count(conn, "public.events where id = %s", eid) == 1  # still waiting, so she can still open it
        as_person(conn, ravi)
        assert count(conn, "public.events where id = %s", eid) == 0  # declined: the hidden plan is gone for him
        as_person(conn, stranger)
        assert count(conn, "public.tickets where event_id = %s", eid) == 0
        assert count(conn, "public.events where id = %s", eid) == 0
        with pytest.raises(Refused):  # and nobody accepts themselves
            conn.execute("update public.tickets set status = 'going' where event_id = %s", (eid,))
    finally:
        conn.execute("reset role")


# ---- what a profile shows to others ----

def test_events_someone_went_to_follow_their_privacy_choice(conn):
    asha, follower, stranger = person(conn), person(conn), person(conn)
    eid = host_event(conn, person(conn))
    conn.execute("insert into public.attendances (user_id, event_id, mood) values (%s, %s, 'loved')", (asha, eid))
    conn.execute("insert into public.follows (follower_id, followee_id) values (%s, %s)", (follower, asha))

    def seen_by(who):
        as_person(conn, who)
        n = count(conn, "public.attendances where user_id = %s", asha)
        conn.execute("reset role")
        return n

    try:
        assert (seen_by(asha), seen_by(follower), seen_by(stranger)) == (1, 1, 0)  # the default: followers only
        conn.execute("update public.profiles set attended_visibility = 'public' where id = %s", (asha,))
        assert (seen_by(asha), seen_by(follower), seen_by(stranger)) == (1, 1, 1)
        conn.execute("update public.profiles set attended_visibility = 'private' where id = %s", (asha,))
        assert (seen_by(asha), seen_by(follower), seen_by(stranger)) == (1, 0, 0)
        as_visitor(conn)
        with pytest.raises(Refused):
            conn.execute("select 1 from public.attendances")
    finally:
        conn.execute("reset role")


def test_saved_lists_are_private_and_draft_recaps_are_hidden(conn):
    asha, ravi, host = person(conn), person(conn), person(conn)
    listed, draft = host_event(conn, host), host_event(conn, host, status="draft")
    list_id = conn.execute("insert into public.saved_lists (user_id, name) values (%s, 'Weekend') returning id", (asha,)).fetchone()[0]
    conn.execute("insert into public.saved_items (list_id, event_id) values (%s, %s)", (list_id, listed))
    conn.execute("insert into public.event_recaps (event_id, body) values (%s, 'Great'), (%s, 'Not out yet')", (listed, draft))
    try:
        as_person(conn, ravi)
        assert count(conn, "public.saved_lists where user_id = %s", asha) == 0
        assert count(conn, "public.saved_items where list_id = %s", list_id) == 0
        assert count(conn, "public.event_recaps where event_id = %s", draft) == 0
        assert count(conn, "public.event_recaps where event_id = %s", listed) == 1
        for sql, args in (("insert into public.follows (follower_id, followee_id) values (%s, %s)", (ravi, asha)),
                          ("insert into public.saved_items (list_id, event_id) values (%s, %s)", (list_id, draft)),
                          ("delete from public.event_recaps where event_id = %s", (listed,))):
            with pytest.raises(Refused):  # writes go through the server only
                conn.execute(sql, args)
        as_person(conn, asha)
        assert count(conn, "public.saved_items where list_id = %s", list_id) == 1
    finally:
        conn.execute("reset role")
