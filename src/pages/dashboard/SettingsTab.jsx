import { useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { useResourcesData } from '../../context/useResourcesData'
import { supabase } from '../../lib/supabaseClient'
import IstDateTimePicker from '../../components/IstDateTimePicker'
import { formatIstDisplay } from '../../utils/istDateTime'
import './Dashboard.css'

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

const SettingsTab = () => {
  const { profile } = useAuth()
  const {
    analyticsDemoMode,
    maintenanceMode,
    maintenanceUntil,
    maintenanceMessage,
    maintenanceAutoOff,
    submissionIntakeEnabled,
    refresh,
  } = useResourcesData()

  const isOwner = profile?.role === 'owner'
  const isDeveloper = isOwner || !!profile?.is_developer

  const [savingKey, setSavingKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [untilDraft, setUntilDraft] = useState(maintenanceUntil || '')
  const [messageDraft, setMessageDraft] = useState(maintenanceMessage || '')

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

  const saveMaintenanceDetails = async () => {
    setSavingKey('maintenance_details')
    await supabase.from('global_resources').upsert([
      { key: 'maintenance_until', value: untilDraft || '' },
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
        <h4>Maintenance</h4>
        <ToggleRow
          label="Maintenance mode"
          hint="Show a maintenance page to everyone except admins."
          checked={maintenanceMode}
          allowed={isDeveloper && savingKey !== 'maintenance_mode'}
          onToggle={() => setSetting('maintenance_mode', maintenanceMode ? 'false' : 'true')}
        />
        {!isDeveloper && <p className="settings-toggle-note">Only the owner or a developer can change this.</p>}

        {isDeveloper && (
          <>
            <ToggleRow
              label="Turn off automatically"
              hint="Once the time below passes, maintenance mode turns off the next time an admin opens the site."
              checked={maintenanceAutoOff}
              allowed={savingKey !== 'maintenance_auto_off'}
              onToggle={() => setSetting('maintenance_auto_off', maintenanceAutoOff ? 'false' : 'true')}
            />

            <div className="settings-field-block">
              <span className="settings-field-label">Expected back around</span>
              <IstDateTimePicker value={untilDraft} onChange={setUntilDraft}>
                {maintenanceUntil && <span className="settings-field-hint">Currently set: {formatIstDisplay(maintenanceUntil)}</span>}

                <label className="settings-field-label ist-message-label">Message shown to visitors</label>
                <textarea
                  className="settings-textarea"
                  rows={3}
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="CivilPYQ is down for maintenance right now."
                />

                <div className="settings-save-row">
                  <button className="action-btn approve-btn" disabled={savingKey === 'maintenance_details'} onClick={saveMaintenanceDetails}>
                    {savingKey === 'maintenance_details' ? 'Saving…' : 'Save details'}
                  </button>
                  {savedKey === 'maintenance_mode' && <span className="settings-saved-note">Saved.</span>}
                  {savedKey === 'maintenance_auto_off' && <span className="settings-saved-note">Saved.</span>}
                  {savedKey === 'maintenance_details' && <span className="settings-saved-note">Saved.</span>}
                </div>
              </IstDateTimePicker>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SettingsTab
