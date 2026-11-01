const BACKUP_PREFIX = 'history-backup-'
const DRYRUN_PREFIX = 'history-dryrun-'
const QUIET_SCHEDULED_MIN = 30
const QUIET_EMERGENCY_MIN = 5
const MIN_REMAINING_MS = 5 * 60 * 1000
const STALE_RUN_MS = 30 * 60 * 1000
const EMERGENCY_LOCK_MS = 90 * 60 * 1000
const SAMPLE_SIZE = 5

async function withRetry(fn, tries, sleep) {
  let lastError
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < tries - 1) await sleep(1000 * 2 ** attempt)
    }
  }
  throw lastError
}

function result(run, ok, status, message, extra = {}) {
  return { ok, status, message, runId: run ? run.id : null, ...extra }
}

function headRef(branch) {
  return `heads/${branch}`
}

async function finish(deps, run, status, phase, message, patch = {}) {
  const finishedAt = new Date(deps.clock()).toISOString()
  await deps.db.updateRun(run.id, { status, phase, finished_at: finishedAt, error: status === 'succeeded' ? null : message, ...patch })
  await deps.db.audit({ actor: run.started_by || 'system', event: status, run, message, details: patch.details })
  return result(run, status === 'succeeded', status, message)
}

async function verifySwap(deps, run, branch, expectedHead, treeSha, refsBefore) {
  const head = await deps.github.getRef(headRef(branch))
  if (head !== expectedHead) return `Branch head is ${head} instead of ${expectedHead}.`
  const commit = await deps.github.getCommit(expectedHead)
  if (commit.parents.length !== 0) return 'The new commit still has parents.'
  if (commit.treeSha !== treeSha) return 'The new commit has a different file tree.'
  const refsAfter = (await deps.github.listRefs()).filter((ref) => !ref.startsWith(`refs/heads/${BACKUP_PREFIX}`))
  const missing = refsBefore.filter((ref) => !refsAfter.includes(ref))
  if (missing.length) return `Refs disappeared: ${missing.join(', ')}.`
  const samples = await deps.db.sampleLivePaths(SAMPLE_SIZE)
  for (const sample of samples) {
    const file = await deps.github.getFile(sample.path, branch)
    if (!file) return `Live file missing after the rewrite: ${sample.path}.`
    if (sample.size && file.size && Number(sample.size) !== Number(file.size)) {
      return `Live file size changed: ${sample.path}.`
    }
  }
  return null
}

async function rollback(deps, run, branch, oldHead) {
  try {
    await withRetry(() => deps.github.updateRef(headRef(branch), oldHead, true), 3, deps.sleep)
    const head = await deps.github.getRef(headRef(branch))
    return head === oldHead
  } catch {
    return false
  }
}

function recoveryCommand(config, oldHead, branch) {
  return `gh api -X PATCH repos/${config.owner}/${config.repo}/git/refs/heads/${branch} -f sha=${oldHead} -F force=true`
}

export async function recoverStaleRuns(deps, config) {
  const stale = await deps.db.findStaleRuns(STALE_RUN_MS)
  const outcomes = []
  for (const run of stale) {
    const branch = config.branch
    const swapPhases = ['swapping', 'swapped', 'verifying']
    if (swapPhases.includes(run.phase) && run.new_head_sha && run.old_head_sha) {
      const head = await deps.github.getRef(headRef(branch))
      if (head === run.old_head_sha) {
        await cleanupRefs(deps, run)
        await finish(deps, run, 'aborted', 'recovered', 'Stopped before the branch moved.')
        outcomes.push({ runId: run.id, outcome: 'aborted' })
      } else if (head === run.new_head_sha) {
        const refsBefore = (run.details && run.details.refsBefore) || []
        const problem = await verifySwap(deps, run, branch, run.new_head_sha, run.tree_sha, refsBefore)
        if (!problem) {
          await cleanupRefs(deps, run)
          await finish(deps, run, 'succeeded', 'recovered', 'Interrupted after the move. Verified afterwards.')
          outcomes.push({ runId: run.id, outcome: 'verified' })
        } else if (await rollback(deps, run, branch, run.old_head_sha)) {
          await finish(deps, run, 'rolled_back', 'recovered', `Interrupted run rolled back. ${problem}`)
          outcomes.push({ runId: run.id, outcome: 'rolled_back' })
        } else {
          await finish(deps, run, 'failed', 'rollback_failed', `Rollback failed. ${recoveryCommand(config, run.old_head_sha, branch)}`)
          outcomes.push({ runId: run.id, outcome: 'failed' })
        }
      } else {
        await finish(deps, run, 'failed', 'unexpected_head', `Branch head changed unexpectedly (${head}). Nothing restored.`)
        outcomes.push({ runId: run.id, outcome: 'failed' })
      }
    } else {
      await cleanupRefs(deps, run)
      await finish(deps, run, 'aborted', 'recovered', 'Stopped before the branch moved.')
      outcomes.push({ runId: run.id, outcome: 'aborted' })
    }
  }
  return outcomes
}

async function cleanupRefs(deps, run) {
  const refs = await deps.github.listRefs().catch(() => [])
  const short = String(run.id).slice(0, 8)
  for (const ref of refs) {
    if (ref === `refs/heads/${BACKUP_PREFIX}${short}` || ref === `refs/heads/${DRYRUN_PREFIX}${short}`) {
      await deps.github.deleteRef(ref.replace('refs/', '')).catch(() => {})
    }
  }
}

export async function runHistoryCleanup(deps, config, params) {
  const { kind, dryRun, startedBy, reason } = params
  const branch = config.branch
  const emergency = kind === 'emergency'
  const quietMinutes = emergency ? QUIET_EMERGENCY_MIN : QUIET_SCHEDULED_MIN
  const nowMs = () => deps.clock()

  const running = await deps.db.findActiveRun(params.runId || null)
  if (running) {
    return result(running, false, 'aborted', 'Another cleanup is already running.')
  }

  let run
  if (params.runId) {
    run = await deps.db.getRun(params.runId)
    if (!run || run.status !== 'waiting') return result(run, false, 'aborted', 'That emergency run is no longer waiting.')
  } else if (emergency) {
    run = await deps.db.createRun({
      kind,
      dry_run: dryRun,
      status: 'waiting',
      phase: 'waiting',
      started_by: startedBy,
      reason,
      lock_until: new Date(nowMs() + EMERGENCY_LOCK_MS).toISOString(),
    })
    await deps.db.audit({ actor: startedBy, event: 'started', run, message: 'Emergency cleanup requested.' })
  } else {
    const lock = await deps.db.lockStatus()
    const startsAt = lock.starts_at ? Date.parse(lock.starts_at) : null
    const endsAt = lock.ends_at ? Date.parse(lock.ends_at) : null
    if (!lock.locked || lock.reason !== kind || startsAt === null || endsAt === null || nowMs() < startsAt) {
      return result(null, false, 'aborted', 'Outside the lock window.')
    }
    if (endsAt - nowMs() < MIN_REMAINING_MS) {
      const early = await deps.db.createRun({ kind, dry_run: dryRun, status: 'aborted', phase: 'late', started_by: 'system', run_month: params.runMonth, finished_at: new Date(nowMs()).toISOString(), error: 'Too close to the end of the lock window.' })
      await deps.db.audit({ actor: 'system', event: 'aborted', run: early, message: 'Too close to the end of the lock window.' })
      return result(early, false, 'aborted', 'Too close to the end of the lock window.')
    }
    run = await deps.db.createRun({ kind, dry_run: dryRun, status: 'running', phase: 'preflight', started_by: 'system', run_month: params.runMonth })
    await deps.db.audit({ actor: 'system', event: 'started', run, message: `${dryRun ? 'Test run' : 'Cleanup'} started.` })
  }

  const abort = async (message, patch = {}) => {
    await cleanupRefs(deps, run)
    return finish(deps, run, 'aborted', run.phase || 'aborted', message, patch)
  }
  const setPhase = async (phase, patch = {}) => {
    run = { ...run, phase, ...patch }
    await deps.db.updateRun(run.id, { phase, status: run.status === 'waiting' ? 'running' : run.status, ...patch })
  }

  try {
    run = { ...run, status: 'running' }
    await deps.db.updateRun(run.id, { status: 'running', phase: 'preflight' })

    if (!dryRun && !(await deps.db.hasSucceededDryRun())) {
      return await abort('A test run must pass before the first live run.')
    }

    const repo = await deps.github.getRepo()
    if (repo.status === 401 || repo.status === 403) return await abort('GitHub token rejected.')
    if (repo.status !== 200) return await abort(`Could not read the repository (HTTP ${repo.status}).`)
    if (repo.archived) return await abort('The repository is archived.')
    if (!repo.canPush) return await abort('Token cannot push to the repository.')
    await deps.db.setTokenExpiry(repo.tokenExpiresAt || null)
    if (repo.tokenExpiresAt && Date.parse(repo.tokenExpiresAt) < nowMs()) return await abort('GitHub token expired.')

    const branchInfo = await deps.github.getBranch(branch)
    if (!branchInfo) return await abort(`Branch ${branch} was not found.`)
    if (branchInfo.protected && !dryRun) return await abort('Branch is protected. Allow force pushes.')

    const refsBefore = (await deps.github.listRefs()).filter((ref) => !ref.startsWith(`refs/heads/${BACKUP_PREFIX}`) && !ref.startsWith(`refs/heads/${DRYRUN_PREFIX}`))
    const expectedRefs = [`refs/heads/${branch}`]
    const extraRefs = refsBefore.filter((ref) => !expectedRefs.includes(ref))
    const leftovers = (await deps.github.listRefs()).filter((ref) => ref.startsWith(`refs/heads/${BACKUP_PREFIX}`) || ref.startsWith(`refs/heads/${DRYRUN_PREFIX}`))

    const quietCheck = async () => {
      const head = await deps.github.getBranch(branch)
      const commit = await deps.github.getCommit(head.sha)
      const ageMin = (nowMs() - Date.parse(commit.committedAt)) / 60000
      if (ageMin < quietMinutes) return { quiet: false, waitMin: Math.ceil(quietMinutes - ageMin) }
      const pushes = await deps.github.recentPushes(new Date(nowMs() - quietMinutes * 60000).toISOString(), branch)
      if (pushes.length) return { quiet: false, waitMin: quietMinutes }
      return { quiet: true }
    }

    const quiet = await quietCheck()
    if (!quiet.quiet) {
      if (emergency) {
        await deps.db.updateRun(run.id, { status: 'waiting', phase: 'waiting' })
        return result(run, false, 'waiting', `Repository busy. Retry in ${quiet.waitMin} min.`, { retryAfterMinutes: quiet.waitMin })
      }
      return await abort('Recent repository activity. Postponed.')
    }

    let purgeSummary = { skipped: true }
    if (!dryRun) {
      await setPhase('purge')
      const purge = await deps.db.runPurge(run.id)
      purgeSummary = purge
    }

    await setPhase('snapshot')
    const head1 = await deps.github.getBranch(branch)
    const commit1 = await deps.github.getCommit(head1.sha)
    const oldHead = head1.sha
    const treeSha = commit1.treeSha
    const sizeBefore = (await deps.github.getRepo()).sizeKb
    const backupRef = `heads/${BACKUP_PREFIX}${String(run.id).slice(0, 8)}`
    await setPhase('backup', {
      old_head_sha: oldHead,
      tree_sha: treeSha,
      backup_ref: `refs/${backupRef}`,
      repo_size_before_kb: sizeBefore,
      details: { refsBefore, extraRefs, leftovers, purge: purgeSummary, tokenExpiresAt: repo.tokenExpiresAt || null },
    })
    await withRetry(() => deps.github.createRef(`refs/${backupRef}`, oldHead), 3, deps.sleep)

    await setPhase('commit')
    const dateLabel = new Date(nowMs()).toISOString().slice(0, 10)
    const newHead = await withRetry(() => deps.github.createRootCommit({ treeSha, message: `Clean history (${dateLabel})` }), 3, deps.sleep)

    if (dryRun) {
      const tempRef = `heads/${DRYRUN_PREFIX}${String(run.id).slice(0, 8)}`
      await withRetry(() => deps.github.createRef(`refs/${tempRef}`, newHead), 3, deps.sleep)
      await withRetry(() => deps.github.updateRef(tempRef, newHead, true), 3, deps.sleep)
      const tempHead = await deps.github.getRef(tempRef)
      await deps.github.deleteRef(tempRef).catch(() => {})
      await deps.github.deleteRef(backupRef).catch(() => {})
      if (tempHead !== newHead) return await abort('Test branch could not be created.', { details: { ...run.details } })
      return await finish(deps, run, 'succeeded', 'dry_run_done', `Test run passed.${extraRefs.length ? ` Extra refs: ${extraRefs.join(', ')}.` : ''}`, { new_head_sha: newHead })
    }

    const lock = emergency ? { locked: true, ends_at: run.lock_until } : await deps.db.lockStatus()
    if (!lock.locked || (lock.ends_at && Date.parse(lock.ends_at) - nowMs() < MIN_REMAINING_MS)) {
      await deps.github.deleteRef(backupRef).catch(() => {})
      return await abort('Not enough time left in the lock window.')
    }
    const head2 = await deps.github.getBranch(branch)
    if (head2.sha !== oldHead) {
      await deps.github.deleteRef(backupRef).catch(() => {})
      return await abort('Branch changed during preparation. Cancelled.')
    }
    await setPhase('swapping', { new_head_sha: newHead })
    try {
      await deps.github.updateRef(headRef(branch), newHead, true)
    } catch (error) {
      await deps.github.deleteRef(backupRef).catch(() => {})
      return await abort(`GitHub refused to move the branch: ${error.message}`)
    }
    await setPhase('verifying')

    let problem = null
    try {
      problem = await verifySwap(deps, run, branch, newHead, treeSha, refsBefore)
    } catch (error) {
      problem = `Verification failed to run: ${error.message}`
    }

    if (problem) {
      const restored = await rollback(deps, run, branch, oldHead)
      if (restored) {
        return await finish(deps, run, 'rolled_back', 'rolled_back', `Verification failed. Branch restored. ${problem}`)
      }
      return await finish(deps, run, 'failed', 'rollback_failed', `Verification and automatic restore failed. ${problem} Restore manually: ${recoveryCommand(config, oldHead, branch)}`)
    }

    let backupKept = false
    try {
      await withRetry(() => deps.github.deleteRef(backupRef), 3, deps.sleep)
    } catch {
      backupKept = true
    }
    return await finish(deps, run, 'succeeded', 'done', backupKept ? 'History cleaned. Backup branch kept.' : 'History cleaned.', { new_head_sha: newHead, details: { ...(run.details || {}), backupKept } })
  } catch (error) {
    await deps.db.audit({ actor: run.started_by || 'system', event: 'error', run, message: error.message })
    await deps.db.updateRun(run.id, { status: 'failed', phase: run.phase, error: error.message, finished_at: new Date(nowMs()).toISOString() })
    return result(run, false, 'failed', `Unexpected error: ${error.message}`)
  }
}

export async function runFollowup(deps, config) {
  const run = await deps.db.findFollowupRun(6 * 3600 * 1000)
  if (!run) return null
  const repo = await deps.github.getRepo()
  const samples = await deps.db.sampleLivePaths(SAMPLE_SIZE)
  const failed = []
  for (const sample of samples) {
    const check = await deps.github.checkCdn(sample.path, config.branch)
    if (!check.ok || (sample.size && check.size && Number(sample.size) !== Number(check.size))) failed.push(sample.path)
  }
  const health = { ok: failed.length === 0, checked: samples.length, failed }
  await deps.db.updateRun(run.id, {
    repo_size_after_kb: repo.sizeKb,
    followup_done: true,
    details: { ...(run.details || {}), health },
  })
  await deps.db.audit({
    actor: 'system',
    event: health.ok ? 'followup' : 'health_failed',
    run,
    message: health.ok ? 'Morning check passed.' : `Morning check failed for ${failed.length} file(s).`,
    details: { repo_size_before_kb: run.repo_size_before_kb, repo_size_after_kb: repo.sizeKb, health },
  })
  return { runId: run.id, health, sizeBefore: run.repo_size_before_kb, sizeAfter: repo.sizeKb }
}

export { QUIET_SCHEDULED_MIN, QUIET_EMERGENCY_MIN, EMERGENCY_LOCK_MS }
