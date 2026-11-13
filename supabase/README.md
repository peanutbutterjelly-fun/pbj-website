# Supabase (database and login)

Project: `xpzrsslqfnhzqcxxkkjo`, Singapore region. Dashboard: https://supabase.com/dashboard/project/xpzrsslqfnhzqcxxkkjo

## What's here

- `migrations/`: every change to the database, as numbered SQL files, applied in order. Never edit one that has been applied; add a new file instead.
  - `…_leads.sql`: sign-ups and filled forms from the List Your Event page. The website can only add rows; read them in the dashboard's Table Editor.
  - `…_profiles.sql`: one profile per login (name, photo, city, role), made automatically on sign-up. People can read and edit only their own; only the team changes roles.
- `config.toml`: settings for the Supabase CLI and a local copy of Supabase (`supabase start`, needs Docker).

## One-time setup on your computer

```bash
supabase login                                   # opens the browser, or paste an access token
supabase link --project-ref xpzrsslqfnhzqcxxkkjo # from the repo's top folder; asks for the database password
```

## Making a database change

```bash
supabase migration new add_events   # creates supabase/migrations/<timestamp>_add_events.sql
# write the SQL, then:
supabase db push                    # applies new migrations to the live project
```

Every new table needs row level security turned on and policies saying who can read and write it. Use a `feat(backend)` or `chore(backend)` PR for the change.

## Keys

- **Website** (`frontend/.env.local`): `VITE_SUPABASE_URL` and the **publishable** key. Safe in the browser.
- **Backend** (`backend/.env`, and Railway variables): `SUPABASE_URL`, `DATABASE_URL`, and the **secret** key. Never in the website.
