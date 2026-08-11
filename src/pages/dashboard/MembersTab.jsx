import { useEffect, useRef, useState } from 'react'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
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
]

function emptyPermissions() {
  return PERMISSION_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: false }), {})
}

function adminRoleLabel(member) {
  return member.is_faculty ? 'faculty admin' : 'admin'
}

function adminRoleChipClass(member) {
  return member.is_faculty ? 'role-chip role-admin-faculty' : 'role-chip role-admin'
}

const PermissionCheckboxes = ({ values, onChange }) => (
  <div className="member-permissions-edit">
    {PERMISSION_FIELDS.map((f) => (
      <label key={f.key} className="elective-checkbox">
        <input
          type="checkbox"
          checked={!!values[f.key]}
          onChange={(e) => onChange({ ...values, [f.key]: e.target.checked })}
        />
        {f.label}
      </label>
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
      setActionError("This didn't save — you may not have permission to edit members. Ask an owner to check your access.")
      return
    }
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm(`Remove ${member.email} as an admin?`)) return
    setActionError('')
    const { data, error } = await supabase.from('admins').delete().eq('email', member.email).select()

    if (error) {
      setActionError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setActionError("This didn't delete — you may not have permission to remove members. Ask an owner to check your access.")
      return
    }
    onChanged()
  }

  if (editing) {
    return (
      <div className="member-card">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="member-username-input" />
        <div className="member-email">{member.email}</div>
        <label className="elective-checkbox">
          <input type="checkbox" checked={isFaculty} onChange={(e) => setIsFaculty(e.target.checked)} />
          Faculty admin
        </label>
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
          <button className="icon-btn danger" onClick={remove} aria-label="Remove"><DeleteIcon sx={{ fontSize: 16 }} /></button>
        </div>
      </div>
      <div className="member-email">{member.email}</div>
      {actionError && <p className="dashboard-error">{actionError}</p>}
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
        <button className="action-btn reject-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
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
      .order('role')
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('Could not load members.')
        } else {
          setMembers(data || [])
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

  const owners = members.filter((m) => m.role === 'owner')
  const admins = members.filter((m) => m.role === 'admin')

  return (
    <div className="dashboard-panel">
      <div className="resource-group">
        <h4>Owners</h4>
        <div className="members-list">
          {owners.map((member) => (
            <div className="member-card" key={member.email}>
              <div className="member-card-header">
                <span className="member-name">{member.username || member.email}</span>
                <span className="role-chip role-owner">owner</span>
              </div>
              <div className="member-email">{member.email}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="resource-group">
        <h4>Admins</h4>
        <div className="members-list">
          {admins.map((member) =>
            canEditMembers ? (
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