import os
from pathlib import Path

import pytest

# Tests never touch the real database or Supabase
os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_URL"] = "https://test.supabase.co"

MIGRATIONS = sorted((Path(__file__).resolve().parents[2] / "supabase" / "migrations").glob("*.sql"))

# Supabase's own pieces (roles, the auth and storage schemas), cut down to what the migrations use
STUB = """
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role; -- what Supabase does for every new table
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated; -- as on Supabase: the rules below decide
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
"""


@pytest.fixture(scope="session")
def pg(tmp_path_factory):
    """A throwaway Postgres with every migration applied in order (needs the `pgserver` package; skipped without it)."""
    pgserver = pytest.importorskip("pgserver")
    import psycopg

    server = pgserver.get_server(tmp_path_factory.mktemp("pg"))
    with psycopg.connect(server.get_uri(), autocommit=True) as conn:
        conn.execute(STUB)
        for sql in MIGRATIONS:
            conn.execute(sql.read_text())
    yield server.get_uri()
    server.cleanup()
