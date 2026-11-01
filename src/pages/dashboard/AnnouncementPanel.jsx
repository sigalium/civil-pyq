import { useCallback, useEffect, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ConfirmModal from '../../components/ConfirmModal'
import AnnouncementEditor from './AnnouncementEditor'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/useAuth'
import { useNotifications } from '../../context/useNotifications'
import { toPlainText } from '../../utils/announcementMarkdown'
import './Dashboard.css'

const MAX_MESSAGE = 2000
const PAGE_SIZE = 5

const AnnouncementPanel = () => {
  const { session } = useAuth()
  const { notify } = useNotifications()
  const [title, setTitle] = useState('')
  const [underline, setUnderline] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (targetPage) => {
    const from = targetPage * PAGE_SIZE
    const { data, count } = await supabase
      .from('announcements')
      .select('id, title, message, title_underline, created_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    const totalCount = count ?? 0
    if (!data?.length && targetPage > 0 && totalCount > 0) {
      setPage(Math.max(0, Math.ceil(totalCount / PAGE_SIZE) - 1))
      return
    }
    setItems(data || [])
    setTotal(totalCount)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  const reset = () => {
    setTitle('')
    setUnderline(false)
    setMessage('')
    setEditingId(null)
    setError('')
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setTitle(item.title)
    setUnderline(!!item.title_underline)
    setMessage(item.message)
    setError('')
  }

  const send = async () => {
    if (!title.trim() || !message.trim()) return
    setSending(true)
    setError('')
    const fields = { title: title.trim(), message: message.trim(), title_underline: underline }
    const { error: saveError } = editingId
      ? await supabase.from('announcements').update(fields).eq('id', editingId)
      : await supabase.from('announcements').insert({ ...fields, created_by: session?.user?.email || null })
    setSending(false)
    if (saveError) {
      setError(editingId ? 'Could not save the changes.' : 'Could not send the announcement.')
      return
    }
    notify({ variant: 'success', message: editingId ? 'Announcement updated.' : 'Announcement sent to everyone.' })
    reset()
    if (page === 0) load(0)
    else setPage(0)
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    const { error: deleteError } = await supabase
      .from('announcements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', target.id)
    if (deleteError) {
      notify({ variant: 'error', message: 'Could not delete the announcement.' })
      return
    }
    if (editingId === target.id) reset()
    notify({ variant: 'success', message: 'Announcement deleted.' })
    load(page)
  }

  return (
    <div className="resource-group">
      <h4>Announcement</h4>
      <AnnouncementEditor
        title={title}
        onTitleChange={setTitle}
        underline={underline}
        onUnderlineChange={setUnderline}
        message={message}
        onMessageChange={setMessage}
        maxMessage={MAX_MESSAGE}
        disabled={sending}
      />
      {error && <p className="dashboard-error">{error}</p>}
      <div className="settings-save-row announcement-actions">
        <button className="action-btn approve-btn" disabled={sending || !title.trim() || !message.trim()} onClick={send}>
          {sending ? 'Saving…' : editingId ? 'Save changes' : 'Send to everyone'}
        </button>
        {editingId && (
          <button className="action-btn neutral-btn" disabled={sending} onClick={reset}>
            Cancel edit
          </button>
        )}
      </div>

      {!loading && items.length > 0 && (
        <div className="announcement-history">
          <span className="settings-field-label">Recent</span>
          {items.map((item) => (
            <div className="announcement-row" key={item.id}>
              <div className="announcement-row-text">
                <strong>{item.title}</strong>
                <span>{toPlainText(item.message)}</span>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              <div className="announcement-row-actions">
                <button className="icon-btn" onClick={() => startEdit(item)} aria-label="Edit announcement">
                  <EditIcon sx={{ fontSize: 18 }} />
                </button>
                <button className="icon-btn danger" onClick={() => setDeleteTarget(item)} aria-label="Delete announcement">
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </button>
              </div>
            </div>
          ))}
          {total > PAGE_SIZE && (
            <div className="pagination-bar">
              <button className="action-btn neutral-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </button>
              <span className="pagination-status">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button className="action-btn neutral-btn" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this announcement?"
          message="It disappears from everyone's notifications."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default AnnouncementPanel
