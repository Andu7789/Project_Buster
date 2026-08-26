# Project Buster

Pastel, white-first web app (Vite + React + TypeScript, Supabase-backed) replacing weekly Excel
sheets for PS Management Services. See [README.md](README.md) for full setup/feature docs.

## Deployment

Deploys to **Cloudflare Workers** (static assets), not Netlify — `wrangler.jsonc` is already
configured, serving `./dist` as a single-page app.

```bash
npm run deploy   # = npm run build && wrangler deploy
```

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` must be set in `.env.local` before building — Vite
  inlines them at build time.
- Deploying needs Cloudflare auth for the `project-buster` Worker (`account_id` in
  `wrangler.jsonc`). Locally this is `npx wrangler login` (interactive browser OAuth). In a
  non-interactive/cloud environment, browser login isn't possible — auth instead via a
  `CLOUDFLARE_API_TOKEN` environment variable (Cloudflare dashboard → My Profile → API Tokens →
  create one with Workers Scripts:Edit permission). If neither is available, stop and tell the
  user to run `npm run deploy` locally rather than guessing at credentials.
