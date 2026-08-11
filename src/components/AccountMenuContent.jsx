import { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import LoginIcon from '@mui/icons-material/Login'
import { useAuth } from '../context/AuthContext'
import SignOutConfirmModal from './SignOutConfirmModal'

const AccountMenuContent = ({ itemClassName, onNavigate }) => {
  const { status, session, profile, signInWithGoogle, signOut } = useAuth()
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

  if (status === 'admin') {
    return (
      <>
        <div className="account-menu-email">
          <div className="account-menu-username">{profile?.username || session?.user?.email}</div>
          <div>{session?.user?.email}</div>
          <span className="account-menu-role-chip">{profile?.role}</span>
        </div>
        <Link to="/dashboard" className={itemClassName} onClick={onNavigate}>
          <DashboardIcon sx={{ fontSize: 18 }} /> Dashboard
        </Link>
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
