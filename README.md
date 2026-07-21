# Project Buster

Project Buster is a pastel, white-first web app for replacing weekly Excel sheets with a simple digital
workflow, built for PS Management Services.

## What is included

- A worker portal (`/`) — sign up, submit a weekly timesheet, and browse past timesheets read-only
- An owner portal (`/owner`) — separate login, team stats, a weekly-totals chart, worker onboarding/suspend/remove, and invoice tracking
- Supabase-backed auth and data (no mock data) with row-level security enforcing who can see and edit what

## One-time setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Run `supabase/schema.sql` once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
   Edit the commented seed insert at the bottom of that file with your own name/email first — that's what lets you sign
   up as the owner.
3. Copy `.env.example` to `.env.local` and fill in your project's values (Supabase Dashboard → Settings → API):
   ```bash
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Start the app
   ```bash
   npm run dev
   ```
5. Go to `/owner`, choose "Create an account" and sign up with the email you seeded in step 2. From there, use the
   "Add worker" form to invite your team — each worker then signs up themselves at `/` using the email you added them
   with.

If your Supabase project has "Confirm email" turned on (Authentication → Providers → Email), new sign-ups need to
click a confirmation link before they can sign in. Turn it off for a faster demo, or just check the inbox.

## Deployment

This project deploys to Netlify as a static site (`netlify.toml` is already configured, including the redirect rule
client-side routing needs). Connect the GitHub repo at app.netlify.com and set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` in the site's environment variables before the first deploy.
