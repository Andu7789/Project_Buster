// Relays request-tracker events (new request / status change / comment) to
// Telegram. Runs server-side because the bot token is a secret - it can
// never be shipped in the client bundle, so the browser calls this function
// instead of the Telegram API directly.
//
// Deploy: supabase functions deploy notify-telegram
// Secrets (supabase secrets set ...): TELEGRAM_BOT_TOKEN, TELEGRAM_DEV_CHAT_ID,
// TELEGRAM_OWNER_CHAT_ID. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically for every edge function - no need to set those.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type NotifyEvent = 'request_created' | 'status_changed' | 'comment_added'

interface NotifyPayload {
  event: NotifyEvent
  requestId: string
  requestTitle: string
  requestType?: string
  priority?: string
  status?: string
  progress?: number
  resolutionNotes?: string | null
  commentBody?: string
  actorName: string
}

const typeLabels: Record<string, string> = { bug: 'Bug', feature: 'Feature idea', billing: 'Charge request' }
const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  needs_info: 'Needs your input',
  completed: 'Completed',
  declined: 'Declined',
}

function buildMessage(role: string, payload: NotifyPayload): string {
  const title = payload.requestTitle

  if (payload.event === 'request_created') {
    const type = typeLabels[payload.requestType ?? ''] ?? payload.requestType ?? 'Request'
    const priority = payload.priority ? ` (${payload.priority} priority)` : ''
    return `🆕 New ${type.toLowerCase()}${priority} from ${payload.actorName}\n"${title}"`
  }

  if (payload.event === 'status_changed') {
    const status = statusLabels[payload.status ?? ''] ?? payload.status ?? 'updated'
    if (payload.status === 'needs_info') {
      return `❓ Question on "${title}"\n${payload.resolutionNotes ?? ''}`.trim()
    }
    if (payload.status === 'completed') {
      return `✅ "${title}" marked complete${payload.resolutionNotes ? `\n${payload.resolutionNotes}` : ''}`
    }
    return `🔄 "${title}" is now ${status.toLowerCase()} (${payload.progress ?? 0}%)`
  }

  // comment_added
  return `💬 ${payload.actorName} replied on "${title}":\n${payload.commentBody ?? ''}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('buster_profiles')
      .select('role, status')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle()

    if (profileError || !profile || profile.status !== 'active' || !['owner', 'developer'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = (await req.json()) as NotifyPayload
    if (!payload.event || !payload.requestTitle) {
      return new Response(JSON.stringify({ error: 'Missing event or requestTitle' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Requests always go to the developer; status updates always go back to
    // the owner; a comment goes to whichever side didn't just post it.
    const targetsOwner = payload.event === 'status_changed' || (payload.event === 'comment_added' && profile.role === 'developer')
    const chatId = targetsOwner ? Deno.env.get('TELEGRAM_OWNER_CHAT_ID') : Deno.env.get('TELEGRAM_DEV_CHAT_ID')
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!botToken || !chatId) {
      console.error('Telegram secrets not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_DEV_CHAT_ID / TELEGRAM_OWNER_CHAT_ID)')
      return new Response(JSON.stringify({ error: 'Telegram is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = buildMessage(profile.role, payload)

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })

    if (!telegramResponse.ok) {
      const detail = await telegramResponse.text()
      console.error('Telegram API error:', detail)
      return new Response(JSON.stringify({ error: 'Telegram API error', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-telegram error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
