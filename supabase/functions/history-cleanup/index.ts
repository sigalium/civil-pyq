import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createGithubClient } from '../_shared/github-client.ts'
import { recoverStaleRuns, runHistoryCleanup, runFollowup, QUIET_EMERGENCY_MIN } from '../_shared/history-cleanup-core.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const STALE_MS = 30 * 60 * 1000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function extractRepoPath(url) {
  if (typeof url !== 'string' || !url) return null
  const match = url.match(/\/gh\/[^/]+\/[^@]+@[^/]+\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

function buildDb(supabase, cronSecret) {
  const nowIso = () => new Date().toISOString()
  return {
    async lockStatus() {
      const { data } = await supabase.rpc('cleanup_lock_status')
      return data || { locked: false }
    },
    async createRun(fields) {
      const { data, error } = await supabase.from('history_cleanup_runs').insert(fields).select('*').single()
      if (error) throw new Error(`Could not record the run: ${error.message}`)
      return data
    },
    async getRun(id) {
      const { data } = await supabase.from('history_cleanup_runs').select('*').eq('id', id).maybeSingle()
      return data
    },
    async updateRun(id, patch) {
      const { error } = await supabase.from('history_cleanup_runs').update({ ...patch, updated_at: nowIso() }).eq('id', id)
      if (error) throw new Error(`Could not update the run record: ${error.message}`)
    },
    async findActiveRun(excludeId) {
      const { data } = await supabase
        .from('history_cleanup_runs')
        .select('*')
        .in('status', ['running', 'waiting'])
      const now = Date.now()
      return (
        (data || []).find((run) => {
          if (run.id === excludeId) return false
          if (run.status === 'waiting') return run.lock_until && Date.parse(run.lock_until) > now
          return now - Date.parse(run.updated_at) < STALE_MS
        }) || null
      )
    },
    async findStaleRuns(ms) {
      const { data } = await supabase.from('history_cleanup_runs').select('*').in('status', ['running', 'waiting'])
      const now = Date.now()
      return (data || []).filter((run) => {
        if (run.status === 'waiting') return !run.lock_until || Date.parse(run.lock_until) <= now
        return now - Date.parse(run.updated_at) >= ms
      })
    },
    async findFollowupRun(ms) {
      const { data } = await supabase
        .from('history_cleanup_runs')
        .select('*')
        .eq('status', 'succeeded')
        .eq('dry_run', false)
        .eq('followup_done', false)
        .order('finished_at', { ascending: false })
        .limit(1)
      const run = data && data[0]
      return run && Date.now() - Date.parse(run.finished_at) >= ms ? run : null
    },
    async hasSucceededDryRun() {
      const { count } = await supabase
        .from('history_cleanup_runs')
        .select('id', { count: 'exact', head: true })
        .eq('dry_run', true)
        .eq('status', 'succeeded')
      return (count || 0) > 0
    },
    async runPurge(runId) {
      try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/purge-expired`, {
          method: 'POST',
          headers: { 'x-cron-secret': cronSecret, 'x-cleanup-run-id': runId, 'Content-Type': 'application/json' },
          body: '{}',
        })
        const body = await response.json().catch(() => ({}))
        return { ok: response.ok, status: response.status, ...body }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
    async sampleLivePaths(count) {
      const { data } = await supabase
        .from('resources')
        .select('path, file_size_bytes')
        .is('deleted_at', null)
        .limit(300)
      const rows = (data || [])
        .map((row) => ({ path: extractRepoPath(row.path), size: row.file_size_bytes }))
        .filter((row) => row.path)
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[rows[i], rows[j]] = [rows[j], rows[i]]
      }
      return rows.slice(0, count)
    },
    async setRepoPushedAt(value) {
      const { data } = await supabase.from('cleanup_settings').select('repo_pushed_at').eq('id', 1).maybeSingle()
      const current = data && data.repo_pushed_at ? Date.parse(data.repo_pushed_at) : NaN
      if (current === Date.parse(value)) return
      await supabase.from('cleanup_settings').update({ repo_pushed_at: value }).eq('id', 1)
    },
    async setTokenExpiry(value) {
      await supabase.from('cleanup_settings').update({ token_expires_at: value }).eq('id', 1)
    },
    async audit({ actor, event, run, message, details }) {
      await supabase.from('audit_log').insert({
        actor_email: actor || 'system',
        action: 'RUN',
        table_name: 'history_cleanup',
        record_id: run ? String(run.id) : null,
        details: {
          event,
          message,
          kind: run ? run.kind : null,
          dry_run: run ? run.dry_run : null,
          reason: run ? run.reason : null,
          ...(details || {}),
        },
      })
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const owner = Deno.env.get('GITHUB_OWNER')
  const repo = Deno.env.get('GITHUB_REPO')
  const branch = Deno.env.get('GITHUB_BRANCH') || 'main'
  const token = Deno.env.get('GITHUB_TOKEN')
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  if (!owner || !repo || !token) return json({ error: 'GitHub is not configured.' }, 500)

  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const config = { owner, repo, branch, token }
  const deps = {
    github: createGithubClient(config),
    db: buildDb(supabase, cronSecret),
    clock: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }

  const providedSecret = req.headers.get('x-cron-secret') || ''
  const isCron = cronSecret && providedSecret === cronSecret

  try {
    if (isCron) {
      const cronBody = await req.json().catch(() => ({}))
      const pushedAt = typeof cronBody.repo_pushed_at === 'string' ? Date.parse(cronBody.repo_pushed_at) : NaN
      if (Number.isFinite(pushedAt) && pushedAt <= Date.now() + 3600000) {
        await deps.db.setRepoPushedAt(new Date(pushedAt).toISOString())
      }
      const recovered = await recoverStaleRuns(deps, config)
      const repoInfo = await deps.github.getRepo()
      if (repoInfo.status === 200) await deps.db.setTokenExpiry(repoInfo.tokenExpiresAt || null)

      const status = await deps.db.lockStatus()
      const { data: settings } = await supabase.from('cleanup_settings').select('dry_run').eq('id', 1).maybeSingle()
      if (status.locked && (status.reason === 'scheduled' || status.reason === 'fallback')) {
        const outcome = await runHistoryCleanup(deps, config, {
          kind: status.reason,
          dryRun: settings ? settings.dry_run : true,
          startedBy: 'system',
          runMonth: status.next_run_month,
        })
        return json({ recovered, cleanup: outcome }, outcome.ok || outcome.status === 'aborted' ? 200 : 500)
      }
      const followup = await runFollowup(deps, config)
      return json({ recovered, followup, message: 'No cleanup is scheduled right now.' })
    }

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) return json({ error: 'Missing authorization.' }, 401)
    const authClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'))
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)
    const email = userData && userData.user && userData.user.email
    if (userError || !email) return json({ error: 'Not authenticated.' }, 401)

    const { data: admin } = await supabase.from('admins').select('role, is_developer').eq('email', email).maybeSingle()
    if (!admin || !(admin.role === 'owner' || admin.is_developer)) {
      return json({ error: 'Only the owner or a developer can run the cleanup.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    if (body.confirm !== 'CLEAN') return json({ error: 'Type CLEAN to confirm.' }, 400)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!body.run_id && reason.length < 5) return json({ error: 'Reason required.' }, 400)

    const outcome = await runHistoryCleanup(deps, config, {
      kind: 'emergency',
      dryRun: !!body.dry_run,
      startedBy: email,
      reason,
      runId: body.run_id || null,
    })
    const status = outcome.status === 'waiting' ? 202 : outcome.ok ? 200 : 409
    return json({ ...outcome, quietMinutes: QUIET_EMERGENCY_MIN }, status)
  } catch (error) {
    return json({ error: error.message }, 500)
  }
})
