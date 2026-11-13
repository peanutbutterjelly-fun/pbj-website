# Saving sign-ups and filled forms (Supabase)

The "SIGN UP" and "FILL THE FORM" buttons in the Know more windows on List Your Event already work on the page. They save to a Supabase table called `leads` once these three steps are done (about 10 minutes, free plan is enough):

1. Make a free project at supabase.com.
2. In the project: SQL Editor > New query, paste everything from `supabase/schema.sql` (in the top folder), press Run.
3. In the project: Project Settings > API. Copy the **Project URL** and the **anon public** key. Copy `frontend/.env.example` to `frontend/.env.local` and paste them in. Restart the site.

Until then the forms still open and check the details, but say "Saving is not connected yet" and nothing is sent or stored.

To read the sign-ups: Supabase > Table Editor > `leads` (it can export to a spreadsheet). Each row says whether it was a quick `signup` or a `form`, and which slide it came from (`role`). The website can only add rows; it cannot read, change or delete any.

When the site goes live, add the same two values in the hosting service's settings (they are not stored in the code).
