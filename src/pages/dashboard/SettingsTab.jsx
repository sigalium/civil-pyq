import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { useResourcesData } from '../../context/useResourcesData'
import { supabase } from '../../lib/supabaseClient'
import IstDateTimePicker from '../../components/IstDateTimePicker'
import { formatIstDisplay } from '../../utils/istDateTime'
import { backfillFileSizes } from '../../utils/backfillFileSizes'
import './Dashboard.css'

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (days || hours) parts.push(`${hours}h`)
  if (days || hours || minutes) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

const ToggleRow = ({ label, hint, checked, allowed, onToggle }) => (
  <label className={`toggle-switch-field settings-toggle-row ${allowed ? '' : 'disabled'}`}>
    <div>
      <span className="settings-toggle-label">{label}</span>
      <span className="settings-toggle-hint">{hint}</span>
    </div>
    <span className={`toggle-switch ${checked ? 'on' : ''}`} onClick={allowed ? onToggle : undefined}>
      <span className="toggle-switch-knob" />
    </span>
  </label>
)

const RunRow = ({ label, hint, onRun, running, allowed }) => (
  <div className={`toggle-switch-field settings-toggle-row ${allowed ? '' : 'disabled'}`}>
    <div>
      <span className="settings-toggle-label">{label}</span>
      <span className="settings-toggle-hint">{hint}</span>
    </div>
    <button className="action-btn preview-btn" disabled={!allowed || running} onClick={onRun}>
      {running ? 'Running…' : 'Run'}
    </button>
  </div>
)

const SegmentedToggle = ({ options, value, onChange, disabled }) => {
  const activeIndex = options.findIndex((opt) => opt.value === value)
  return (
    <div className={`segmented-toggle ${disabled ? 'is-disabled' : ''}`} aria-disabled={disabled}>
      <span className={`segmented-toggle-highlight ${activeIndex === 1 ? 'position-1' : ''}`} />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`segmented-toggle-option ${opt.value === value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const SettingsTab = () => {
  const { profile } = useAuth()
  const {
    analyticsDemoMode,
    maintenanceActive,
    maintenanceUntil,
    maintenanceType,
    maintenanceMessage,
    maintenanceStartedAt,
    submissionIntakeEnabled,
    refresh,
  } = useResourcesData()

  const isOwner = profile?.role === 'owner'
  const isDeveloper = isOwner || !!profile?.is_developer

  const [savingKey, setSavingKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [typeDraft, setTypeDraft] = useState(maintenanceType === 'scheduled' ? 'scheduled' : 'indefinite')
  const [untilDraft, setUntilDraft] = useState(maintenanceActive ? (maintenanceUntil || '') : '')
  const [messageDraft, setMessageDraft] = useState(maintenanceMessage || '')
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [backfillResult, setBackfillResult] = useState(null)
  const [backfillError, setBackfillError] = useState('')

  useEffect(() => {
    if (!(maintenanceActive && maintenanceStartedAt)) return undefined
    const interval = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [maintenanceActive, maintenanceStartedAt])

  const flashSaved = (key) => {
    setSavedKey(key)
    setTimeout(() => setSavedKey((current) => (current === key ? '' : current)), 2500)
  }

  const setSetting = async (key, value) => {
    setSavingKey(key)
    await supabase.from('global_resources').upsert({ key, value })
    await refresh()
    setSavingKey('')
    flashSaved(key)
  }

  const startMaintenance = async () => {
    setSavingKey('maintenance_start')
    await supabase.from('global_resources').upsert([
      { key: 'maintenance_mode', value: 'true' },
      { key: 'maintenance_type', value: typeDraft },
      { key: 'maintenance_until', value: typeDraft === 'scheduled' ? untilDraft : '' },
      { key: 'maintenance_message', value: messageDraft },
      { key: 'maintenance_started_at', value: new Date().toISOString() },
    ])
    await refresh()
    setSavingKey('')
    flashSaved('maintenance_start')
  }

  const endMaintenanceNow = async () => {
    setSavingKey('maintenance_end')
    await supabase.from('global_resources').upsert({ key: 'maintenance_mode', value: 'false' })
    await refresh()
    setSavingKey('')
    flashSaved('maintenance_end')
  }

  const runBackfill = async () => {
    setBackfillError('')
    setBackfillResult(null)
    setBackfillBusy(true)
    try {
      const result = await backfillFileSizes()
      setBackfillResult(result)
      await refresh()
    } catch (err) {
      setBackfillError(err.message)
    }
    setBackfillBusy(false)
  }

  const saveMaintenanceDetails = async () => {
    setSavingKey('maintenance_details')
    await supabase.from('global_resources').upsert([
      { key: 'maintenance_until', value: maintenanceType === 'scheduled' ? untilDraft : '' },
      { key: 'maintenance_message', value: messageDraft },
    ])
    await refresh()
    setSavingKey('')
    flashSaved('maintenance_details')
  }

  return (
    <div className="dashboard-panel">
      <div className="resource-group">
        <h4>Analytics</h4>
        <ToggleRow
          label="Demo mode"
          hint="Show sample analytics data instead of real numbers."
          checked={analyticsDemoMode}
          allowed={isOwner && savingKey !== 'analytics_demo_mode'}
          onToggle={() => setSetting('analytics_demo_mode', analyticsDemoMode ? 'false' : 'true')}
        />
        {!isOwner && <p className="settings-toggle-note">Only the site owner can change this.</p>}
        {savedKey === 'analytics_demo_mode' && <p className="settings-saved-note">Saved.</p>}
      </div>

      <div className="resource-group">
        <h4>Submissions</h4>
        <ToggleRow
          label="Submission intake"
          hint="Turn off to pause new uploads from the public Contribute page."
          checked={submissionIntakeEnabled}
          allowed={savingKey !== 'submission_intake_enabled'}
          onToggle={() => setSetting('submission_intake_enabled', submissionIntakeEnabled ? 'false' : 'true')}
        />
        {savedKey === 'submission_intake_enabled' && <p className="settings-saved-note">Saved.</p>}
      </div>

      <div className="resource-group">
        <h4>Storage</h4>
        <RunRow
          label="File size backfill"
          hint="Fills in file sizes for older uploads that don't have one recorded yet. Safe to run again anytime."
          onRun={runBackfill}
          running={backfillBusy}
          allowed={isOwner}
        />
        {!isOwner && <p className="settings-toggle-note">Only the site owner can change this.</p>}
        {backfillError && <p className="dashboard-error">{backfillError}</p>}
        {backfillResult && (
          <p className="settings-saved-note">
            Checked {backfillResult.total}, updated {backfillResult.updated}
            {backfillResult.skipped ? `, skipped ${backfillResult.skipped} (non-GitHub path)` : ''}
            {backfillResult.failed ? `, ${backfillResult.failed} failed` : ''}.
            {backfillResult.sampleError ? ` Error: ${backfillResult.sampleError}` : ''}
          </p>
        )}
      </div>

      <div className="resource-group maintenance-panel">
        <div className="maintenance-panel-header">
          <h4>Maintenance</h4>
        </div>

        {!isDeveloper && <p className="settings-toggle-note">Only the owner or a developer can change this.</p>}

        {isDeveloper && (
          <div className="maintenance-panel-body">
            {maintenanceActive && (
              <p className="settings-field-hint maintenance-panel-hint">
                {maintenanceType === 'scheduled'
                  ? `Ends automatically at ${formatIstDisplay(maintenanceUntil)}.`
                  : 'Indefinite - ends only when you end it below.'}
              </p>
            )}

            <SegmentedToggle
              value={maintenanceActive ? (maintenanceType === 'scheduled' ? 'scheduled' : 'indefinite') : typeDraft}
              onChange={setTypeDraft}
              disabled={maintenanceActive}
              options={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'indefinite', label: 'Indefinite' },
              ]}
            />

            <div className="settings-field-block">
              <span className="settings-field-label">Ends at</span>
            </div>

            <div className="maintenance-datetime-grid">
              <IstDateTimePicker
                value={untilDraft}
                onChange={setUntilDraft}
                disabled={(maintenanceActive ? maintenanceType : typeDraft) !== 'scheduled'}
              />

              <div className="maintenance-status-box">
                <span className={`maintenance-status-pill ${maintenanceActive ? 'is-active' : ''}`}>
                  <span className="maintenance-status-dot" />
                  {maintenanceActive ? 'Active' : 'Off'}
                </span>

                <div className="maintenance-status-timer">
                  <Timer size={16} />
                  {maintenanceActive && maintenanceStartedAt ? (
                    <>
                      <span>Active for</span>
                      <span className="maintenance-timer-value">{formatDuration(nowTick - new Date(maintenanceStartedAt).getTime())}</span>
                    </>
                  ) : (
                    <span>Timer starts once maintenance is on</span>
                  )}
                </div>

                {!maintenanceActive && (
                  <>
                    <p className="maintenance-status-hint">Currently off. Configure and start below.</p>
                    {maintenanceStartedAt && (
                      <p className="maintenance-status-hint maintenance-status-hint-muted">
                        Last on {formatIstDisplay(maintenanceStartedAt)}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="settings-field-block maintenance-message-field">
                <label className="settings-field-label">Message shown to visitors</label>
                <textarea
                  className="settings-textarea"
                  rows={6}
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="CivilPYQ is down for maintenance right now."
                />
              </div>

              <div className="settings-save-row">
                {maintenanceActive ? (
                  <>
                    <button className="action-btn approve-btn" disabled={savingKey === 'maintenance_details'} onClick={saveMaintenanceDetails}>
                      {savingKey === 'maintenance_details' ? 'Saving…' : 'Save changes'}
                    </button>
                    <button className="action-btn reject-btn" disabled={savingKey === 'maintenance_end'} onClick={endMaintenanceNow}>
                      {savingKey === 'maintenance_end' ? 'Ending…' : 'End maintenance now'}
                    </button>
                    {savedKey === 'maintenance_details' && <span className="settings-saved-note">Saved.</span>}
                    {savedKey === 'maintenance_end' && <span className="settings-saved-note">Ended.</span>}
                  </>
                ) : (
                  <>
                    <button
                      className="action-btn approve-btn"
                      disabled={savingKey === 'maintenance_start' || (typeDraft === 'scheduled' && !untilDraft)}
                      onClick={startMaintenance}
                    >
                      {savingKey === 'maintenance_start' ? 'Starting…' : 'Start maintenance'}
                    </button>
                    {savedKey === 'maintenance_start' && <span className="settings-saved-note">Started.</span>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsTab
