import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import SignOutConfirmModal from '../components/SignOutConfirmModal'
import SubmissionsTab from './dashboard/SubmissionsTab'
import ResourcesTab from './dashboard/ResourcesTab'
import UploadTab from './dashboard/UploadTab'
import MigrationTab from './dashboard/MigrationTab'
import ContributorsTab from './dashboard/ContributorsTab'
import TrashTab from './dashboard/TrashTab'
import MembersTab from './dashboard/MembersTab'
import LogTab from './dashboard/LogTab'
import AnalyticsTab from './dashboard/AnalyticsTab'
import SettingsTab from './dashboard/SettingsTab'
import './dashboard/Dashboard.css'

const Dashboard = () => {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const isOwner = profile?.role === 'owner'
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(tabParam ? [tabParam] : []))

  const TABS = [
    { id: 'submissions', label: 'Submissions', visible: isOwner || profile?.can_review_submissions, Component: SubmissionsTab },
    { id: 'resources', label: 'Resources', visible: isOwner || profile?.can_edit_resources || profile?.can_delete_resources, Component: ResourcesTab },
    { id: 'upload', label: 'Upload', visible: isOwner || profile?.can_edit_resources, Component: UploadTab },
    { id: 'migration', label: 'Migration', visible: isOwner || profile?.can_edit_resources, Component: MigrationTab },
    { id: 'contributors', label: 'Contributors', visible: isOwner || profile?.can_manage_contributors, Component: ContributorsTab },
    { id: 'trash', label: 'Trash', visible: isOwner || profile?.can_view_trash, Component: TrashTab },
    { id: 'members', label: 'Members', visible: isOwner || profile?.can_view_members || profile?.can_edit_members, Component: MembersTab },
    { id: 'audit', label: 'Log', visible: isOwner || profile?.can_view_audit_log, Component: LogTab },
    { id: 'analytics', label: 'Analytics', visible: isOwner || profile?.can_view_analytics, Component: AnalyticsTab },
    { id: 'settings', label: 'Settings', visible: isOwner || profile?.can_manage_settings, Component: SettingsTab },
  ].filter((t) => t.visible)

  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : TABS[0]?.id

  const handleTabChange = (id) => {
    navigate(`/dashboard/${id}`, { replace: true })
  }

  useEffect(() => {
    if (tab && tabParam !== tab) {
      navigate(`/dashboard/${tab}`, { replace: true })
    }
  }, [tab, tabParam])

  useEffect(() => {
    if (!tab) return
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
  }, [tab])

  return (
    <div className="dashboard fade-in">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <button className="sign-out-btn" onClick={() => setConfirmSignOut(true)}>Sign out</button>
        </div>

        <div className="dashboard-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`dashboard-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {TABS.length > 0 ? (
          TABS.map((t) =>
            visitedTabs.has(t.id) ? (
              <div key={t.id} className="dashboard-tab-panel" style={{ display: t.id === tab ? 'block' : 'none' }}>
                <t.Component />
              </div>
            ) : null
          )
        ) : (
          <p className="dashboard-empty">You don't have access to any dashboard sections yet.</p>
        )}
      </div>

      {confirmSignOut && (
        <SignOutConfirmModal onConfirm={signOut} onCancel={() => setConfirmSignOut(false)} />
      )}
    </div>
  )
}

export default Dashboard
