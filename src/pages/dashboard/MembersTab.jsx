import { useEffect, useRef, useState } from 'react'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabaseClient'
import { adminRoleLabel, adminRoleChipClass, memberSortWeight } from '../../utils/adminRoles'
import ConfirmModal from '../../components/ConfirmModal'
import './Dashboard.css'

const PERMISSION_FIELDS = [
  { key: 'can_review_submissions', label: 'Submissions' },
  { key: 'can_edit_resources', label: 'Edit resources' },
  { key: 'can_delete_resources', label: 'Trash resources' },
  { key: 'can_view_trash', label: 'View trash' },
  { key: 'can_view_audit_log', label: 'Audit log' },
  { key: 'can_view_members', label: 'View members' },
  { key: 'can_edit_members', label: 'Edit members' },
  { key: 'can_manage_contributors', label: 'Contributors' },
  { key: 'can_view_analytics', label: 'Analytics' },
  { key: 'can_manage_settings', label: 'Settings' },
  { key: 'is_developer', label: 'Developer' },
]

function emptyPermissions() {
  return PERMISSION_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: false }), {})
}

const ToggleRow = ({ label, checked, onChange, className = '' }) => (
  <label className={`toggle-switch-field member-toggle-row ${className}`}>
    <span>{label}</span>
    <span className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-switch-knob" />
    </span>
  </label>
)

const PermissionCheckboxes = ({ values, onChange }) => (
  <div className="member-permissions-edit">
    {PERMISSION_FIELDS.map((f) => (
      <ToggleRow
        key={f.key}
        label={f.label}
        checked={!!values[f.key]}
        onChange={(next) => onChange({ ...values, [f.key]: next })}
      />
    ))}
  </div>
)

const AdminRow = ({ member, onChanged }) => {
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(member.username || '')
  const [isFaculty, setIsFaculty] = useState(!!member.is_faculty)
  const [permissions, setPermissions] = useState(
    PERMISSION_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: !!member[f.key] }), {})
  )
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const save = async () => {
    setSaving(true)
    setActionError('')
    const { data, error } = await supabase
      .from('admins')
      .update({ username, is_faculty: isFaculty, ...permissions })
      .eq('email', member.email)
      .select()

    setSaving(false)

    if (error) {
      setActionError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setActionError("This didn't save. You may not have permission to edit members. Ask an owner to check your access.")
      return
    }
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    setConfirmRemove(false)
    setActionError('')
    const { data, error } = await supabase.from('admins').delete().eq('email', member.email).select()

    if (error) {
      setActionError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setActionError("This didn't delete. You may not have permission to remove members. Ask an owner to check your access.")
      return
    }
    onChanged()
  }

  if (editing) {
    return (
      <div className="member-card">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="member-username-input" />
        <div className="member-email">{member.email}</div>
        <ToggleRow label="Faculty admin" checked={isFaculty} onChange={setIsFaculty} className="member-faculty-toggle" />
        <PermissionCheckboxes values={permissions} onChange={setPermissions} />
        {actionError && <p className="dashboard-error">{actionError}</p>}
        <div className="resource-item-actions">
          <button className="action-btn approve-btn" disabled={saving} onClick={save}>Save</button>
          <button className="action-btn reject-btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="member-card">
      <div className="member-card-header">
        <span className="member-name">{member.username || member.email}</span>
        <span className={adminRoleChipClass(member)}>{adminRoleLabel(member)}</span>
        <div className="subject-panel-actions" style={{ marginLeft: 'auto' }}>
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit"><EditIcon sx={{ fontSize: 16 }} /></button>
          <button className="icon-btn danger" onClick={() => setConfirmRemove(true)} aria-label="Remove"><DeleteIcon sx={{ fontSize: 16 }} /></button>
        </div>
      </div>
      <div className="member-email">{member.email}</div>
      {actionError && <p className="dashboard-error">{actionError}</p>}
      {confirmRemove && (
        <ConfirmModal
          title="Remove admin?"
          message={`${member.email} will lose access to the dashboard immediately.`}
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      <div className="member-permissions">
        {PERMISSION_FIELDS.filter((f) => member[f.key]).map((f) => (
          <span className="permission-chip" key={f.key}>{f.label}</span>
        ))}
        {PERMISSION_FIELDS.every((f) => !member[f.key]) && (
          <span className="permission-chip permission-chip-none">No permissions granted</span>
        )}
      </div>
    </div>
  )
}

const AddAdminForm = ({ onAdded }) => {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [isFaculty, setIsFaculty] = useState(false)
  const [permissions, setPermissions] = useState(emptyPermissions())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    if (!email.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('admins').insert({
      email: email.trim(),
      username: username.trim() || null,
      role: 'admin',
      is_faculty: isFaculty,
      ...permissions,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setOpen(false)
    setEmail('')
    setUsername('')
    setIsFaculty(false)
    setPermissions(emptyPermissions())
    onAdded()
  }

  if (!open) {
    return (
      <button className="add-inline-btn" onClick={() => setOpen(true)}>
        <AddIcon sx={{ fontSize: 16 }} /> Add admin
      </button>
    )
  }

  return (
    <div className="member-card">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Google account email" className="member-username-input" autoFocus />
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username (optional)" className="member-username-input" />
      <label className="elective-checkbox">
        <input type="checkbox" checked={isFaculty} onChange={(e) => setIsFaculty(e.target.checked)} />
        Faculty admin
      </label>
      <PermissionCheckboxes values={permissions} onChange={setPermissions} />
      {error && <p className="dashboard-error">{error}</p>}
      <div className="resource-item-actions">
        <button className="action-btn approve-btn" disabled={saving} onClick={add}>Add</button>
        <button
          className="action-btn reject-btn"
          onClick={() => {
            setOpen(false)
            setEmail('')
            setUsername('')
            setIsFaculty(false)
            setPermissions(emptyPermissions())
            setError('')
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function memberRank(member) {
  if (member.role === 'owner') return 0
  if (member.is_faculty) return 1
  return 2
}

const MembersTab = () => {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const canEditMembers = isOwner || !!profile?.can_edit_members
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const initializedRef = useRef(false)

  const fetchMembers = () => {
    if (!initializedRef.current) setLoading(true)
    supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('Could not load members.')
        } else {
          const sorted = [...(data || [])].sort((a, b) => memberRank(a) - memberRank(b))
          setMembers(sorted)
        }
        setLoading(false)
        initializedRef.current = true
      })
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  if (loading) return <p className="dashboard-empty">Loading...</p>
  if (error) return <p className="dashboard-error">{error}</p>

  const sortedMembers = [...members].sort((a, b) => memberSortWeight(a) - memberSortWeight(b))

  return (
    <div className="dashboard-panel">
      <div className="resource-group">
        <h4>Members</h4>
        <div className="members-list">
          {sortedMembers.map((member) =>
            member.role === 'admin' && canEditMembers ? (
              <AdminRow key={member.email} member={member} onChanged={fetchMembers} />
            ) : (
              <div className="member-card" key={member.email}>
                <div className="member-card-header">
                  <span className="member-name">{member.username || member.email}</span>
                  <span className={adminRoleChipClass(member)}>{adminRoleLabel(member)}</span>
                </div>
                <div className="member-email">{member.email}</div>
              </div>
            )
          )}
        </div>
        {canEditMembers && <AddAdminForm onAdded={fetchMembers} />}
      </div>
    </div>
  )
}

export default MembersTab