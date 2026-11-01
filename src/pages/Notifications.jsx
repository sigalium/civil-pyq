import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CampaignIcon from '@mui/icons-material/Campaign'
import BuildIcon from '@mui/icons-material/Build'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import BackButton from '../components/BackButton'
import AnnouncementBody from '../components/AnnouncementBody'
import { useInbox } from '../context/useInbox'
import { useCleanup } from '../context/useCleanup'
import { repoIdle, repoIdleText, repoIdleTitle } from '../utils/repoActivity'
import { formatIstTime } from '../utils/istTime'
import './styles/UserLists.css'

const PAGE_SIZE = 15
const FIRST_PAGE_ANNOUNCEMENTS = 1
const LATER_PAGE_ANNOUNCEMENTS = 4

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const describe = (item) => {
  if (item.kind === 'approved') {
    return {
      Icon: CheckCircleIcon,
      title: 'Your submission is live',
      message: `Congratulations! Your submission \u201C${item.label}\u201D has been approved and is now live on CivilPYQ. Thank you for taking the time to share it. Students preparing after you will be grateful.`,
    }
  }
  if (item.kind === 'rejected') {
    return {
      Icon: ErrorOutlineIcon,
      title: 'Update on your submission',
      message: `Thank you for submitting \u201C${item.label}\u201D. After review, it could not be published this time. Please don\u2019t be discouraged. Your effort truly matters, and you are always welcome to submit again.`,
      note: item.reason,
    }
  }
  return { Icon: CampaignIcon, title: item.title, message: item.message }
}

const cleanupNotice = (status, stage) => {
  const start = formatIstTime(status.next_lock_start)
  if (stage === 'day_before') return `Dashboard paused tomorrow, ${start} to ${formatIstTime(status.next_lock_end)} IST.`
  if (stage === 'two_hours') return `Dashboard pauses at ${start} IST.`
  if (stage === 'locked') return `Dashboard paused until ${formatIstTime(status.ends_at || status.next_lock_end)} IST.`
  return ''
}

const announcementPageCount = (total) =>
  total <= FIRST_PAGE_ANNOUNCEMENTS ? 1 : 1 + Math.ceil((total - FIRST_PAGE_ANNOUNCEMENTS) / LATER_PAGE_ANNOUNCEMENTS)

const announcementSlice = (list, page) => {
  if (page === 0) return list.slice(0, FIRST_PAGE_ANNOUNCEMENTS)
  const start = FIRST_PAGE_ANNOUNCEMENTS + (page - 1) * LATER_PAGE_ANNOUNCEMENTS
  return list.slice(start, start + LATER_PAGE_ANNOUNCEMENTS)
}

const Pager = ({ page, pages, onChange }) => (
  <div className="user-list-pagination">
    <button className="user-list-page-btn" disabled={page === 0} onClick={() => onChange(page - 1)}>
      Previous
    </button>
    <span className="user-list-page-status">Page {page + 1} of {pages}</span>
    <button className="user-list-page-btn" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>
      Next
    </button>
  </div>
)

const NotificationCard = ({ item, isNew }) => {
  const { Icon, title, message, note } = describe(item)
  return (
    <div className={`user-list-item notification-item ${item.kind}`}>
      <span className="notification-icon">
        <Icon sx={{ fontSize: 20 }} />
      </span>
      <div className="user-list-body">
        <div className={`notification-head${item.titleUnderline ? ' has-title-rule' : ''}`}>
          <strong>{title}</strong>
          {isNew && <span className="notification-new">New</span>}
        </div>
        {item.kind === 'announcement' ? <AnnouncementBody source={message} /> : <p>{message}</p>}
        {note && <p className="notification-note">Reviewer note: {note}</p>}
        <span className="user-list-meta">{formatDate(item.at)}</span>
      </div>
    </div>
  )
}

const SkeletonRows = () => (
  <div className="user-list">
    {[0, 1, 2].map((i) => (
      <div className="user-list-item skeleton-block" key={i}>
        <span className="skeleton skeleton-circle" />
        <div className="user-list-body">
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line medium" />
        </div>
      </div>
    ))}
  </div>
)

const Notifications = () => {
  const navigate = useNavigate()
  const { announcementItems, personalItems, loading, seenAt, markAllSeen } = useInbox()
  const { status: cleanupStatus, stage: cleanupStage } = useCleanup()
  const [renderedAt] = useState(() => Date.now())
  const idle = repoIdle(cleanupStatus, renderedAt)
  const showCleanupNotice = !!cleanupStatus && cleanupStage !== 'none'
  const previousSeen = useRef(Date.parse(seenAt))
  const [page, setPage] = useState(0)
  const [announcementPage, setAnnouncementPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(personalItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const visibleItems = personalItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const announcementPages = announcementPageCount(announcementItems.length)
  const currentAnnouncementPage = Math.min(announcementPage, announcementPages - 1)
  const visibleAnnouncements = announcementSlice(announcementItems, currentAnnouncementPage)

  useEffect(() => {
    if (!loading) markAllSeen()
  }, [loading, markAllSeen])

  const goToPage = (next) => {
    setPage(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="user-list-page fade-in">
      <div className="user-list-container">
        <BackButton onClick={() => navigate('/')} text="Home" className="back-btn-page-top" />
        <h2 className="user-list-title">Notifications</h2>

        {loading ? (
          <SkeletonRows />
        ) : (
          <>
            {(showCleanupNotice || idle) && (
              <section className="user-list-group">
                <h3 className="user-list-subtitle">System notices</h3>
                <div className="user-list">
                  {showCleanupNotice && (
                    <div className="user-list-item notification-item rejected">
                      <span className="notification-icon">
                        <BuildIcon sx={{ fontSize: 20 }} />
                      </span>
                      <div className="user-list-body">
                        <div className="notification-head">
                          <strong>Monthly cleanup</strong>
                        </div>
                        <p>{cleanupNotice(cleanupStatus, cleanupStage)}</p>
                      </div>
                    </div>
                  )}
                  {idle && (
                    <div className={`user-list-item notification-item ${idle.level === 'over' ? 'rejected' : ''}`}>
                      <span className="notification-icon">
                        <BuildIcon sx={{ fontSize: 20 }} />
                      </span>
                      <div className="user-list-body">
                        <div className="notification-head">
                          <strong>{repoIdleTitle(idle)}</strong>
                        </div>
                        <p>{repoIdleText(idle)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {announcementItems.length > 0 && (
              <section className="user-list-group">
                <h3 className="user-list-subtitle">Announcements</h3>
                <div className="user-list">
                  {visibleAnnouncements.map((item) => (
                    <NotificationCard key={item.key} item={item} isNew={Date.parse(item.at) > previousSeen.current} />
                  ))}
                  {announcementPages > 1 && (
                    <Pager page={currentAnnouncementPage} pages={announcementPages} onChange={setAnnouncementPage} />
                  )}
                </div>
              </section>
            )}

            <section className="user-list-group">
              {announcementItems.length > 0 && <h3 className="user-list-subtitle">Your notifications</h3>}
              {personalItems.length === 0 ? (
                <p className="user-list-empty">
                  {announcementItems.length > 0 ? 'No personal notifications yet.' : 'No notifications yet.'}
                </p>
              ) : (
                <div className="user-list">
                  {visibleItems.map((item) => (
                    <NotificationCard key={item.key} item={item} isNew={Date.parse(item.at) > previousSeen.current} />
                  ))}
                  {totalPages > 1 && <Pager page={currentPage} pages={totalPages} onChange={goToPage} />}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default Notifications
