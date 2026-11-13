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
```

1. Write the SQL in that file. Every new table needs row level security turned on and policies saying who can read and write it.
2. Open a PR titled `feat(backend): …` (or `fix`/`chore`). The **Migrations check** on the PR does a dry run against the live project and lists the migrations that would be applied, so a broken file fails there first.
3. Merge it. GitHub applies the new migrations to Supabase (`supabase db push`), then deploys the backend, in that order, so new tables exist before code that uses them.

Don't run `supabase db push` by hand for a migration that's still in a PR: the PR's file would then be marked as applied before it's reviewed. To apply by hand in an emergency, use GitHub → Actions → Deploy backend → Run workflow.

Never edit or rename a migration that has been applied; add a new one.

## Keys

- **Website** (`frontend/.env.local`): `VITE_SUPABASE_URL` and the **publishable** key. Safe in the browser.
- **Backend** (`backend/.env`, and Railway variables): `SUPABASE_URL`, `DATABASE_URL`, and the **secret** key. Never in the website.
