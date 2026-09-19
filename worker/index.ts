// Serves the SPA's static assets as normal, plus a daily Cron Trigger that pings the
// invoice-reminders Supabase edge function - see supabase/functions/invoice-reminders/index.ts
// for the actual "who's due to be invoiced" logic and Telegram send. Not type-checked by the
// app's own tsc build (excluded from tsconfig.app.json/tsconfig.node.json and eslint, same as
// supabase/functions) since it runs under the Workers runtime, not the browser/DOM one src/ uses.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request)
  },

  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/functions/v1/invoice-reminders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          apikey: env.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      }).catch((err) => console.error('invoice-reminders trigger failed:', err)),
    )
  },
}
