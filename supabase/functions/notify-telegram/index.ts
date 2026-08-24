// Relays request-tracker events (new request / status change / comment), plus
// completed customer-order forms, to Telegram. Runs server-side because the
// bot token is a secret - it can never be shipped in the client bundle, so
// the browser calls this function instead of the Telegram API directly.
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

type NotifyEvent = 'request_created' | 'status_changed' | 'comment_added' | 'customer_order_completed' | 'worker_invoice_created'

interface NotifyPayload {
  event: NotifyEvent
  actorName: string
  // request_created / status_changed / comment_added
  requestId?: string
  requestTitle?: string
  requestType?: string
  priority?: string
  status?: string
  progress?: number
  resolutionNotes?: string | null
  commentBody?: string
  // customer_order_completed - chat ID is resolved server-side from clientId,
  // never trusted from the caller, so a worker can't redirect a message to an
  // arbitrary chat.
  clientId?: string
  clientName?: string
  customType?: string
  buyerUsername?: string
  profileLink?: string
  customInfo?: string
  // worker_invoice_created
  weekStart?: string
  weekEnd?: string
  amount?: number
}

const typeLabels: Record<string, string> = { bug: 'Bug', feature: 'Feature idea', billing: 'Charge request' }
const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  needs_info: 'Needs your input',
  completed: 'Completed',
  declined: 'Declined',
}

function buildMessage(payload: NotifyPayload): string {
  const title = payload.requestTitle ?? ''

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

  if (payload.event === 'worker_invoice_created') {
    return [
      `🧾 New weekly invoice from ${payload.actorName}`,
      `Week: ${payload.weekStart ?? '—'} to ${payload.weekEnd ?? '—'}`,
      `Total: $${(payload.amount ?? 0).toFixed(2)}`,
    ].join('\n')
  }

  if (payload.event === 'customer_order_completed') {
    return [
      `🎬 New custom order from ${payload.actorName}`,
      `Type: ${payload.customType ?? '—'}`,
      `Fan's name: ${payload.buyerUsername ?? '—'}`,
      `Profile link: ${payload.profileLink ?? '—'}`,
      `Details: ${payload.customInfo ?? '—'}`,
    ].join('\n')
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

    if (profileError || !profile || profile.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = (await req.json()) as NotifyPayload

    if (payload.event === 'customer_order_completed') {
      // Only the worker who filled the form (or an owner) can trigger this -
      // distinct from the request-tracker events below, which stay
      // owner/developer only.
      if (!['worker', 'owner'].includes(profile.role)) {
        return new Response(JSON.stringify({ error: 'Not authorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!payload.clientId || !payload.buyerUsername) {
        return new Response(JSON.stringify({ error: 'Missing clientId or buyerUsername' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // The target chat is looked up server-side from the client row, never
      // trusted from the caller - a worker's payload can't redirect the
      // message to an arbitrary chat.
      const { data: client, error: clientError } = await supabaseAdmin
        .from('buster_clients')
        .select('telegram_chat_id')
        .eq('id', payload.clientId)
        .maybeSingle()

      if (clientError || !client?.telegram_chat_id) {
        return new Response(JSON.stringify({ error: 'No Telegram chat configured for this client' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
      if (!botToken) {
        console.error('Telegram secrets not configured (TELEGRAM_BOT_TOKEN)')
        return new Response(JSON.stringify({ error: 'Telegram is not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const text = buildMessage(payload)
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: client.telegram_chat_id, text }),
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
    }

    if (payload.event === 'worker_invoice_created') {
      // Any active worker (or owner) can trigger this - always goes to the
      // owner's own chat, never the caller's choice.
      if (!['worker', 'owner'].includes(profile.role)) {
        return new Response(JSON.stringify({ error: 'Not authorized' }), {
          status: 403,
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

      const text = buildMessage(payload)
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

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['owner', 'developer'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const text = buildMessage(payload)

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
