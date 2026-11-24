"""Deleting an account, checked in a real (throwaway) Postgres with every migration applied: everything linked to the
person goes, nobody else's data does."""

import uuid

import pytest

psycopg = pytest.importorskip("psycopg")


def person(conn, name):
    uid = uuid.uuid4()
    conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s::jsonb)",
                 (uid, f"{name}@x.com", f'{{"full_name": "{name}"}}'))
    return uid


def count(conn, sql, *args):
    return conn.execute(sql, args).fetchone()[0]


def test_deleting_an_account_removes_everything_linked_to_it_and_nothing_else(pg):
    with psycopg.connect(pg, autocommit=True) as conn:
        asha, ravi = person(conn, "asha"), person(conn, "ravi")
        conn.execute("""insert into public.events (id, host_id, status, starts_on, ends_on, data) values
            ('easha1', %s, 'published', '2099-01-01', '2099-01-01', '{"title": "Asha night"}'),
            ('eravi1', %s, 'published', '2099-01-01', '2099-01-01', '{"title": "Ravi night"}')""", (asha, ravi))
        conn.execute("insert into public.event_private (event_id, host_id, data) values ('easha1', %s, '{}')", (asha,))
        conn.execute("insert into public.leads (kind, name, email, user_id) values ('signup', 'Asha', 'asha@x.com', %s), ('signup', 'Ravi', 'ravi@x.com', %s)", (asha, ravi))
        conn.execute("insert into public.leads (kind, name, email) values ('signup', 'Guest', 'guest@x.com')")

        from app.api.routes.me import delete_me, DeleteAccount
        from app.auth import CurrentUser
        with psycopg.connect(pg) as db:  # one transaction, like a real request
            delete_me(DeleteAccount(confirm="DELETE"), CurrentUser(id=asha, email="asha@x.com"), db)
            db.commit()

        assert count(conn, "select count(*) from auth.users where id = %s", asha) == 0
        assert count(conn, "select count(*) from public.profiles where id = %s", asha) == 0
        assert count(conn, "select count(*) from public.events where host_id = %s", asha) == 0
        assert count(conn, "select count(*) from public.event_private where host_id = %s", asha) == 0
        assert count(conn, "select count(*) from public.leads where email = 'asha@x.com'") == 0
        # everyone else's data stays
        assert count(conn, "select count(*) from public.profiles where id = %s", ravi) == 1
        assert count(conn, "select count(*) from public.events where host_id = %s", ravi) == 1
        assert count(conn, "select count(*) from public.leads where email in ('ravi@x.com', 'guest@x.com')") == 2
