import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    const {
      turnstileToken,
      honeypot,
      local_id,
      student_name,
      is_gcu_student,
      enrollment_no,
      institution,
      uploader_semester,
      semester,
      subject,
      resource_type,
      resource_label,
      file_name,
    } = body

    if (honeypot) {
      return json({ error: 'Rejected.' }, 400)
    }

    if (!turnstileToken) {
      return json({ error: 'Missing verification token.' }, 400)
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken }),
    })
    const verifyResult = await verifyResponse.json()
    if (!verifyResult.success) {
      return json({ error: 'Verification failed.' }, 400)
    }

    if (!local_id || !semester || !subject || !resource_type || !resource_label || !file_name) {
      return json({ error: 'Missing required fields.' }, 400)
    }
    if (!['pyq', 'lab', 'syllabus'].includes(resource_type)) {
      return json({ error: 'Invalid resource type.' }, 400)
    }
    if (is_gcu_student && !enrollment_no) {
      return json({ error: 'Enrollment number is required for GCU students.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const clientIp = getClientIp(req)

    const { count: deviceCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('local_id', local_id)
      .gte('created_at', oneHourAgo)

    if ((deviceCount || 0) >= 5) {
      return json({ error: 'Too many submissions from this device. Please try again later.' }, 429)
    }

    if (clientIp !== 'unknown') {
      const { count: ipCount } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('submitter_ip', clientIp)
        .gte('created_at', oneHourAgo)

      if ((ipCount || 0) >= 10) {
        return json({ error: 'Too many submissions from this network. Please try again later.' }, 429)
      }
    }

    const storagePath = `${local_id}/${Date.now()}-${sanitizeFileName(file_name)}`

    const submissionRow = {
      local_id,
      student_name: student_name || null,
      is_gcu_student: !!is_gcu_student,
      enrollment_no: is_gcu_student ? enrollment_no : null,
      institution: is_gcu_student ? null : (institution || null),
      uploader_semester: uploader_semester || null,
      semester,
      subject,
      resource_type,
      resource_label,
      file_path: storagePath,
      submitter_ip: clientIp !== 'unknown' ? clientIp : null,
    }

    let { data: submission, error: insertError } = await supabase
      .from('submissions')
      .insert(submissionRow)
      .select()
      .single()

    if (insertError && insertError.message?.includes('submitter_ip')) {
      delete submissionRow.submitter_ip
      const retry = await supabase.from('submissions').insert(submissionRow).select().single()
      submission = retry.data
      insertError = retry.error
    }

    if (insertError) {
      return json({ error: insertError.message }, 500)
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('pending-uploads')
      .createSignedUploadUrl(storagePath)

    if (signError) {
      await supabase.from('submissions').delete().eq('id', submission.id)
      return json({ error: signError.message }, 500)
    }

    return json({
      submissionId: submission.id,
      path: signed.path,
      token: signed.token,
    })
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500)
  }
})
