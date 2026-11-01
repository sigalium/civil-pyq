import { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import LoginIcon from '@mui/icons-material/Login'
import NotificationsIcon from '@mui/icons-material/Notifications'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import { useAuth } from '../context/useAuth'
import { useInbox } from '../context/useInbox'
import { adminRoleLabel, adminRoleChipClass } from '../utils/adminRoles'
import SignOutConfirmModal from './SignOutConfirmModal'

const AccountMenuContent = ({ itemClassName, onNavigate }) => {
  const { status, session, profile, signInWithGoogle, signOut } = useAuth()
  const { hasUnread } = useInbox()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleConfirmSignOut = async () => {
    setConfirmOpen(false)
    await signOut()
    if (onNavigate) onNavigate()
  }

  const handleSignIn = async () => {
    await signInWithGoogle()
    if (onNavigate) onNavigate()
  }

  const userLinks = (
    <>
      <Link to="/notifications" className={itemClassName} onClick={onNavigate}>
        <NotificationsIcon sx={{ fontSize: 18 }} /> Notifications
        {hasUnread && <span className="alert-dot inline" />}
      </Link>
      <Link to="/bookmarks" className={itemClassName} onClick={onNavigate}>
        <BookmarkIcon sx={{ fontSize: 18 }} /> Bookmarks
      </Link>
      <Link to="/offline-library" className={itemClassName} onClick={onNavigate}>
        <CloudDownloadIcon sx={{ fontSize: 18 }} /> Offline Library
      </Link>
    </>
  )

  if (status === 'admin') {
    return (
      <>
        <div className="account-menu-email">
          <div className="account-menu-username">{profile?.username || session?.user?.email}</div>
          <div>{session?.user?.email}</div>
          <span className={`${adminRoleChipClass(profile)} account-menu-role-chip`}>{adminRoleLabel(profile)}</span>
        </div>
        <Link to="/dashboard" className={itemClassName} onClick={onNavigate}>
          <DashboardIcon sx={{ fontSize: 18 }} /> Dashboard
        </Link>
        {userLinks}
        <Link to="/settings" className={itemClassName} onClick={onNavigate}>
          <SettingsIcon sx={{ fontSize: 18 }} /> Settings
        </Link>
        <button className={itemClassName} onClick={() => setConfirmOpen(true)}>
          <LogoutIcon sx={{ fontSize: 18 }} /> Sign out
        </button>
        {confirmOpen && (
          <SignOutConfirmModal onConfirm={handleConfirmSignOut} onCancel={() => setConfirmOpen(false)} />
        )}
      </>
    )
  }

  return (
    <>
      {userLinks}
      <Link to="/settings" className={itemClassName} onClick={onNavigate}>
        <SettingsIcon sx={{ fontSize: 18 }} /> Settings
      </Link>
      <button className={itemClassName} onClick={handleSignIn}>
        <LoginIcon sx={{ fontSize: 18 }} /> Sign in
      </button>
    </>
  )
}

export default AccountMenuContent
