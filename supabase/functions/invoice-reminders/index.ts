// Daily check for buster_service_clients whose invoice_frequency (weekly/biweekly/monthly,
// set in the app's Team > Service clients section) means they're due to be invoiced again -
// pings the owner's Telegram so a client doesn't get missed. Triggered by Project Buster's own
// Cloudflare Worker Cron Trigger (see worker/index.ts in the repo root), not by a logged-in
// user, so unlike notify-telegram this doesn't check buster_profiles - the only things it does
// are read buster_service_clients and send one Telegram message.
//
// Deploy: supabase functions deploy invoice-reminders
// Secrets used: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID (same ones notify-telegram already
// uses). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
}

/** Next due date after `from`, per the client's chosen cadence - calendar-month aware for "monthly" rather than a flat 30 days. */
function addInterval(from: Date, frequency: string): Date {
  const next = new Date(from)
  if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7)
  else if (frequency === 'biweekly') next.setUTCDate(next.getUTCDate() + 14)
  else next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: serviceClients, error } = await supabaseAdmin
      .from('buster_service_clients')
      .select('name, invoice_frequency, last_invoiced_at, created_at')
      .eq('active', true)
      .not('invoice_frequency', 'is', null)

    if (error) throw error

    const today = new Date()
    const dueLines: string[] = []

    for (const serviceClient of serviceClients ?? []) {
      const frequency = serviceClient.invoice_frequency as string
      // Never invoiced yet - due right away rather than waiting a full cycle from signup.
      const dueDate = serviceClient.last_invoiced_at ? addInterval(new Date(serviceClient.last_invoiced_at), frequency) : today

      if (dueDate <= today) {
        const lastInvoiced = serviceClient.last_invoiced_at ? formatShortDate(serviceClient.last_invoiced_at) : 'never'
        dueLines.push(`- ${serviceClient.name} (${FREQUENCY_LABEL[frequency] ?? frequency}) - last invoiced ${lastInvoiced}`)
      }
    }

    if (dueLines.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const ownerChatId = Deno.env.get('TELEGRAM_OWNER_CHAT_ID')
    if (!botToken || !ownerChatId) {
      console.error('Telegram secrets not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID)')
      return new Response(JSON.stringify({ error: 'Telegram is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = [`🧾 Invoice reminders (${dueLines.length})`, ...dueLines].join('\n')
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChatId, text }),
    })

    if (!telegramResponse.ok) {
      const detail = await telegramResponse.text()
      console.error('Telegram API error:', detail)
      return new Response(JSON.stringify({ error: 'Telegram API error', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, due: dueLines.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('invoice-reminders error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
