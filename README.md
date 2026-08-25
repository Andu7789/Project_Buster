# Project Buster

Project Buster is a pastel, white-first web app for replacing weekly Excel sheets with a simple digital
workflow, built for PS Management Services.

## What is included

- A worker portal (`/`) — sign up, submit a weekly timesheet, and browse past timesheets read-only
- An owner portal (`/owner`) — separate login, team stats, a weekly-totals chart, worker onboarding/suspend/remove, invoice tracking, and a **Requests & Bugs** tab for raising bugs/feature ideas/charge requests with the developer
- A developer portal (`/dev`) — triage every request, update its status/progress, attach a note or question, and reply on its comment thread
- Telegram notifications both ways: the developer is pinged when the owner raises a new request or replies, and the owner is pinged when the developer completes something, asks a question, or replies
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

## Setting up the developer login and Telegram notifications

The **Requests & Bugs** tab (in the owner portal) and the developer portal at `/dev` need a few extra one-time steps,
on top of running `supabase/schema.sql` above (which also creates the `buster_requests` /
`buster_request_comments` tables and a private `request-screenshots` storage bucket).

### 1. Create your developer login

`buster_profiles` requires a unique email per row, so the developer seed at the bottom of `supabase/schema.sql`
uses `andrew.britain7@gmail.com` - a different address from the owner seed above it. Re-run the file, then sign up
at `/dev` with that email.

### 2. Create a Telegram bot

1. Open Telegram and message **@BotFather**.
2. Send `/newbot`, give it a name and a username (must end in `bot`), and BotFather replies with a **bot token** —
   looks like `123456789:AAExampleTokenNotReal`. Keep this secret; anyone with it can send messages as your bot.
3. Message your new bot anything (e.g. "hi") so it has a chat to send to.
4. If the developer and owner are different Telegram accounts, have both message the bot once.

### 3. Get your chat ID(s)

For each person who should get notifications (you as developer, and the business owner):

1. Message **@userinfobot** (or your own new bot) and it/​they will reply with your numeric chat ID, or
2. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` after messaging the bot, and read the
   `"chat":{"id": ...}` value from the JSON response.

### 4. Deploy the notification function and set its secrets

This repo includes `supabase/functions/notify-telegram`, which is the only thing allowed to hold the bot token
(it never reaches the browser). Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy notify-telegram
supabase secrets set \
  TELEGRAM_BOT_TOKEN=123456789:AAExampleTokenNotReal \
  TELEGRAM_DEV_CHAT_ID=your-numeric-chat-id \
  TELEGRAM_OWNER_CHAT_ID=owners-numeric-chat-id
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to every edge function automatically — you don't set
those yourself. Once deployed, raising a request from `/owner`, or updating one from `/dev`, sends a Telegram
message; if the secrets aren't set yet, the app still works, it just logs a notification failure instead of
blocking the request/reply.

## Deployment

This project deploys to Cloudflare Workers as static assets (`wrangler.jsonc` is already configured, serving
`./dist` as a single-page app). Build and deploy with:

```bash
npm run build
npx wrangler deploy
```

The first deploy needs a Cloudflare account with access to the `project-buster` Worker (see `account_id` in
`wrangler.jsonc`) — run `npx wrangler login` first if you haven't authenticated on this machine. Set
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` before building, since Vite inlines them at build time.
