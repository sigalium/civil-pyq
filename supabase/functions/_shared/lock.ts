export async function lockedResponse(supabase, req, corsHeaders) {
  const { data: status } = await supabase.rpc('cleanup_lock_status')
  if (!status || !status.locked) return null

  const runId = req.headers.get('x-cleanup-run-id')
  if (runId) {
    const { data: run } = await supabase
      .from('history_cleanup_runs')
      .select('id, status')
      .eq('id', runId)
      .maybeSingle()
    if (run && run.status === 'running') return null
  }

  return new Response(
    JSON.stringify({
      error: 'The dashboard is paused for the monthly cleanup.',
      locked: true,
      ends_at: status.ends_at,
    }),
    { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
