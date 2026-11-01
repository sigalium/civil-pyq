import { useEffect, useState } from 'react'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { supabase } from '../../lib/supabaseClient'
import { useCleanup } from '../../context/useCleanup'
import { useNotifications } from '../../context/useNotifications'
import { formatIstDay, formatIstShort, formatSizeKb } from '../../utils/istTime'
import EmergencyCleanupModal from './EmergencyCleanupModal'
import './HistoryCleanupPanel.css'

const RUN_DAYS = [1, 2, 3, 4, 7, 8, 11, 12, 15, 16, 19, 20, 23, 24, 27, 28]

const RUN_LABELS = {
  succeeded: 'Finished',
  failed: 'Failed',
  rolled_back: 'Rolled back',
  aborted: 'Did not run',
  running: 'Running',
  waiting: 'Waiting',
}

const RUN_TONES = { succeeded: 'ok', failed: 'bad', rolled_back: 'bad', aborted: 'warn', running: 'warn', waiting: 'warn' }

const monthLabel = (value) =>
  new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' })

const HistoryCleanupPanel = () => {
  const { status, refresh, canControl } = useCleanup()
  const { notify } = useNotifications()
  const settings = status?.settings
  const [enabled, setEnabled] = useState(true)
  const [runDay, setRunDay] = useState(2)
  const [dryRun, setDryRun] = useState(true)
  const [skipped, setSkipped] = useState([])
  const [saving, setSaving] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.enabled)
    setRunDay(settings.run_day)
    setDryRun(settings.dry_run)
    setSkipped(settings.skipped_months || [])
  }, [settings])

  if (!status || !settings) return null

  const nextMonth = status.next_run_month
  const nextSkipped = nextMonth ? skipped.includes(nextMonth) : false
  const last = status.last_run
  const lastSuccess = status.last_success
  const badge = !settings.enabled
    ? { label: 'Off', tone: 'off' }
    : settings.dry_run
      ? { label: 'Test mode', tone: 'test' }
      : { label: 'Live', tone: 'live' }
  const dirty =
    enabled !== settings.enabled ||
    runDay !== settings.run_day ||
    dryRun !== settings.dry_run ||
    JSON.stringify(skipped) !== JSON.stringify(settings.skipped_months || [])

  const alerts = []
  if (last && (last.status === 'failed' || last.status === 'rolled_back' || last.status === 'aborted')) {
    alerts.push({ tone: 'bad', text: `Last run ${last.status === 'aborted' ? 'did not start' : last.status === 'failed' ? 'failed' : 'rolled back'}. See Log.` })
  }
  if (last && last.extra_refs > 0) alerts.push({ tone: 'warn', text: 'Extra branches or tags keep old history.' })
  if (lastSuccess && lastSuccess.health_ok === false) alerts.push({ tone: 'bad', text: 'Morning check failed. See Log.' })

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('update_cleanup_settings', {
      p_enabled: enabled,
      p_run_day: runDay,
      p_dry_run: dryRun,
      p_skipped_months: skipped,
    })
    setSaving(false)
    if (error) {
      notify({ variant: 'error', message: error.message })
      return
    }
    notify({ variant: 'success', message: 'Saved.' })
    refresh()
  }

  const toggleSkip = () => {
    setSkipped((prev) => (prev.includes(nextMonth) ? prev.filter((m) => m !== nextMonth) : [...prev, nextMonth]))
  }

  return (
    <div className="resource-group hc-card">
      <div className="hc-head">
        <h4>Monthly cleanup</h4>
        <div className="hc-badges">
          {!canControl && <span className="hc-badge off">View only</span>}
          <span className={`hc-badge ${badge.tone}`}>{badge.label}</span>
        </div>
      </div>

      <div className="hc-stats">
        <div className="hc-stat">
          <span className="hc-stat-label">Next run</span>
          <strong>{settings.enabled && status.next_run_at ? `${formatIstShort(status.next_run_at)} IST` : 'Not scheduled'}</strong>
        </div>
        <div className="hc-stat">
          <span className="hc-stat-label">Last run</span>
          <strong className="hc-last">
            {last ? (
              <>
                <span className={`hc-dot ${RUN_TONES[last.status] || 'warn'}`} />
                {last.status === 'succeeded' && last.dry_run ? 'Test passed' : RUN_LABELS[last.status] || last.status}, {formatIstDay(last.started_at)}
              </>
            ) : (
              'Never'
            )}
          </strong>
        </div>
        <div className="hc-stat">
          <span className="hc-stat-label">Repository size</span>
          <strong>
            {lastSuccess && lastSuccess.repo_size_before_kb
              ? `${formatSizeKb(lastSuccess.repo_size_before_kb)} → ${lastSuccess.repo_size_after_kb ? formatSizeKb(lastSuccess.repo_size_after_kb) : 'pending'}`
              : 'Not measured'}
          </strong>
        </div>
      </div>

      {alerts.map((alert) => (
        <div className={`hc-alert ${alert.tone}`} key={alert.text}>
          <ErrorOutlineIcon sx={{ fontSize: 18 }} />
          {alert.text}
        </div>
      ))}

      {canControl && (
        <>
          <div className="hc-form">
            <div className="hc-field">
              <span className="hc-field-label">Run day</span>
              <select className="hc-select" value={runDay} onChange={(e) => setRunDay(Number(e.target.value))} disabled={saving}>
                {RUN_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="hc-field">
              <span className="hc-field-label">Mode</span>
              <div className="hc-segment" role="radiogroup" aria-label="Mode">
                <button type="button" role="radio" aria-checked={dryRun} className={dryRun ? 'on' : ''} onClick={() => setDryRun(true)} disabled={saving}>
                  Test
                </button>
                <button type="button" role="radio" aria-checked={!dryRun} className={!dryRun ? 'on' : ''} onClick={() => setDryRun(false)} disabled={saving}>
                  Live
                </button>
              </div>
            </div>
            <div className="hc-field">
              <span className="hc-field-label">Enabled</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Enabled"
                className="hc-switch"
                onClick={() => setEnabled(!enabled)}
                disabled={saving}
              >
                <span className="hc-switch-knob" />
              </button>
            </div>
          </div>
          {dryRun && <p className="hc-note">Test mode makes no changes.</p>}

          <div className="hc-actions">
            <button type="button" className="action-btn approve-btn" onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {nextMonth && (
              <button type="button" className="action-btn neutral-btn" onClick={toggleSkip} disabled={saving}>
                {nextSkipped ? 'Undo skip' : `Skip ${monthLabel(nextMonth)}`}
              </button>
            )}
            <button type="button" className="action-btn reject-btn hc-emergency" onClick={() => setEmergencyOpen(true)}>
              Emergency cleanup
            </button>
          </div>
        </>
      )}

      {emergencyOpen && <EmergencyCleanupModal onClose={() => setEmergencyOpen(false)} onDone={refresh} />}
    </div>
  )
}

export default HistoryCleanupPanel
