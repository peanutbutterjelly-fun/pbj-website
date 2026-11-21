"""Profile rules checked in a real (throwaway) Postgres with every migration applied: what the website's own Supabase
connection may change, and the database's check on photo links."""

import uuid

import pytest

psycopg = pytest.importorskip("psycopg")

BASE = "https://xpzrsslqfnhzqcxxkkjo.supabase.co/storage/v1/object/public/images"


def sign_up(conn, meta='{"full_name": "Asha", "avatar_url": "javascript:alert(1)"}') -> uuid.UUID:
    uid = uuid.uuid4()
    conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, 'a@x.com', %s::jsonb)", (uid, meta))
    return uid


def as_person(conn, uid):
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid),))


def test_sign_up_copies_the_name_but_never_a_photo_link(pg):
    with psycopg.connect(pg, autocommit=True) as conn:
        uid = sign_up(conn)
        row = conn.execute("select full_name, avatar_url, badge from public.profiles where id = %s", (uid,)).fetchone()
        assert row == ("Asha", None, "vibes")


def test_the_website_cannot_write_a_photo_link_but_can_still_edit_its_own_name(pg):
    with psycopg.connect(pg, autocommit=True) as conn:
        uid = sign_up(conn)
        try:
            as_person(conn, uid)
            conn.execute("update public.profiles set full_name = 'Asha K', about = 'Hi' where id = %s", (uid,))
            for column, value in (("avatar_url", f"{BASE}/{uid}/profile/a.jpg"), ("handle", "asha"), ("badge", "pro"), ("role", "admin")):
                with pytest.raises(psycopg.errors.InsufficientPrivilege):
                    conn.execute(f"update public.profiles set {column} = %s where id = %s", (value, uid))
        finally:
            conn.execute("reset role")
        assert conn.execute("select full_name, about from public.profiles where id = %s", (uid,)).fetchone() == ("Asha K", "Hi")


def test_the_database_only_keeps_own_profile_photo_links(pg):
    with psycopg.connect(pg, autocommit=True) as conn:
        uid, other = sign_up(conn), uuid.uuid4()
        for bad in ["javascript:alert(1)", "https://evil.example/a.jpg", f"{BASE}/{other}/profile/a.jpg", f"{BASE}/{uid}/events/a.jpg",
                    f"{BASE}/{uid}/profile/a'.jpg", f"{BASE}/{uid}/profile/x/a.jpg", f"{BASE}/{uid}/profile/a.jpg\"><script>",
                    f"{BASE}/{uid}/profile/%2e%2e"]:
            with pytest.raises(psycopg.errors.CheckViolation):
                conn.execute("update public.profiles set avatar_url = %s where id = %s", (bad, uid))
        good = f"{BASE}/{uid}/profile/m3k2-ab12cd.jpg"
        conn.execute("update public.profiles set avatar_url = %s where id = %s", (good, uid))
        local = f"http://127.0.0.1:54321/storage/v1/object/public/images/{uid}/profile/a.png"  # a local copy of Supabase
        conn.execute("update public.profiles set avatar_url = %s where id = %s", (local, uid))


def test_handles_birthdays_and_badges_are_checked_by_the_database(pg):
    with psycopg.connect(pg, autocommit=True) as conn:
        uid = sign_up(conn)
        for sql, value in (("handle", "Has Caps"), ("badge", "admin"), ("birthday", "1899-12-31"), ("instagram", "no spaces")):
            with pytest.raises(psycopg.errors.CheckViolation):
                conn.execute(f"update public.profiles set {sql} = %s where id = %s", (value, uid))
        with pytest.raises(psycopg.errors.NotNullViolation):
            conn.execute("update public.profiles set badge = null where id = %s", (uid,))
