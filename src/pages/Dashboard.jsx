import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import SignOutConfirmModal from '../components/SignOutConfirmModal'
import SubmissionsTab from './dashboard/SubmissionsTab'
import ResourcesTab from './dashboard/ResourcesTab'
import BulkUploadTab from './dashboard/BulkUploadTab'
import MigrationTab from './dashboard/MigrationTab'
import ContributorsTab from './dashboard/ContributorsTab'
import TrashTab from './dashboard/TrashTab'
import MembersTab from './dashboard/MembersTab'
import AuditLogTab from './dashboard/AuditLogTab'
import './dashboard/Dashboard.css'

const Dashboard = () => {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const isOwner = profile?.role === 'owner'
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const TABS = [
    { id: 'submissions', label: 'Submissions', visible: isOwner || profile?.can_review_submissions, Component: SubmissionsTab },
    { id: 'resources', label: 'Resources', visible: isOwner || profile?.can_edit_resources || profile?.can_delete_resources, Component: ResourcesTab },
    { id: 'bulk-upload', label: 'Bulk Upload', visible: isOwner || profile?.can_edit_resources, Component: BulkUploadTab },
    { id: 'migration', label: 'Migration', visible: isOwner || profile?.can_edit_resources, Component: MigrationTab },
    { id: 'contributors', label: 'Contributors', visible: isOwner || profile?.can_manage_contributors, Component: ContributorsTab },
    { id: 'trash', label: 'Trash', visible: isOwner || profile?.can_view_trash, Component: TrashTab },
    { id: 'members', label: 'Members', visible: isOwner || profile?.can_view_members || profile?.can_edit_members, Component: MembersTab },
    { id: 'audit', label: 'Audit Log', visible: isOwner || profile?.can_view_audit_log, Component: AuditLogTab },
  ].filter((t) => t.visible)

  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : TABS[0]?.id
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0]
  const ActiveComponent = activeTab?.Component

  const handleTabChange = (id) => {
    navigate(`/dashboard/${id}`, { replace: true })
  }

  useEffect(() => {
    if (tab && tabParam !== tab) {
      navigate(`/dashboard/${tab}`, { replace: true })
    }
  }, [tab, tabParam])

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

        {ActiveComponent ? (
          <AnimatePresence mode="wait">
            <Motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <ActiveComponent />
            </Motion.div>
          </AnimatePresence>
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
