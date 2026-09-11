import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_CONTENT_BASE64_LENGTH = 25_400_000
const POLL_ATTEMPTS = 6
const POLL_DELAY_MS = 4000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function summarize(stats, permalink) {
  const malicious = stats?.malicious || 0
  const suspicious = stats?.suspicious || 0
  return {
    status: 'completed',
    malicious: malicious > 0,
    suspicious: suspicious > 0,
    stats,
    permalink,
  }
}

async function pollAnalysis(analysisId, vtHeaders) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const res = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, { headers: vtHeaders })
    const data = await res.json()
    const status = data?.data?.attributes?.status
    if (status === 'completed') {
      return summarize(data.data.attributes.stats, `https://www.virustotal.com/gui/analysis/${analysisId}`)
    }
    await sleep(POLL_DELAY_MS)
  }
  return { status: 'pending', analysisId }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return json({ error: 'Missing authorization token.' }, 401)
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    )
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user?.email) {
      return json({ error: 'Not authenticated.' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { data: admin } = await supabase
      .from('admins')
      .select('role, can_review_submissions, can_edit_resources')
      .eq('email', userData.user.email)
      .maybeSingle()

    const isAllowed = !!admin && (admin.role === 'owner' || admin.can_review_submissions || admin.can_edit_resources)
    if (!isAllowed) {
      return json({ error: 'Not authorized.' }, 403)
    }

    const vtApiKey = Deno.env.get('VIRUSTOTAL_API_KEY')
    if (!vtApiKey) {
      return json({ error: 'Malware scanning is not configured on the server.' }, 500)
    }
    const vtHeaders = { 'x-apikey': vtApiKey }

    const body = await req.json()

    if (body.action === 'check') {
      if (!body.analysisId) return json({ error: 'Missing analysisId.' }, 400)
      const result = await pollAnalysis(body.analysisId, vtHeaders)
      return json(result)
    }

    const { contentBase64 } = body
    if (!contentBase64) {
      return json({ error: 'Missing contentBase64.' }, 400)
    }
    if (contentBase64.length > MAX_CONTENT_BASE64_LENGTH) {
      return json({ error: 'File is too large to scan.' }, 400)
    }

    const bytes = base64ToBytes(contentBase64)
    const hash = await sha256Hex(bytes)

    const lookup = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, { headers: vtHeaders })

    if (lookup.status === 200) {
      const lookupData = await lookup.json()
      const stats = lookupData?.data?.attributes?.last_analysis_stats
      return json(summarize(stats, `https://www.virustotal.com/gui/file/${hash}`))
    }

    if (lookup.status !== 404) {
      const errData = await lookup.json().catch(() => ({}))
      return json({ error: `VirusTotal lookup failed: ${errData?.error?.message || lookup.status}` }, 502)
    }

    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'submission.pdf')

    const uploadRes = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: vtHeaders,
      body: form,
    })

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({}))
      return json({ error: `VirusTotal upload failed: ${errData?.error?.message || uploadRes.status}` }, 502)
    }

    const uploadData = await uploadRes.json()
    const analysisId = uploadData?.data?.id
    if (!analysisId) {
      return json({ error: 'VirusTotal did not return an analysis id.' }, 502)
    }

    const result = await pollAnalysis(analysisId, vtHeaders)
    return json(result)
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500)
  }
})
