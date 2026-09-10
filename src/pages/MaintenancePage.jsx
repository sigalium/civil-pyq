import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { SITE_LINKS } from '../data/appData'
import '../components/css/ProtectedRoute.css'
import './styles/MaintenancePage.css'

function formatUntil(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  if (date.getTime() < now.getTime()) return 'Should be back any moment now.'
  return `Expected back around ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`
}

const MaintenancePage = ({ message }) => {
  const { signInWithGoogle } = useAuth()
  const untilText = formatUntil(message?.until)

  return (
    <div className="gate-screen maintenance-screen">
      <div className="gate-card maintenance-card">
        <h2>We'll be right back</h2>
        <p>
          {message?.text || "CivilPYQ is down for maintenance right now."}
          {untilText ? ` ${untilText}` : ''}
        </p>
        <a
          className="maintenance-alt-domain-btn"
          href={SITE_LINKS.backupDomain}
          target="_blank"
          rel="noopener noreferrer"
        >
          Use the backup site
        </a>
        <Link className="maintenance-offline-btn" to="/offline-library">
          Open offline library
        </Link>
        <div className="maintenance-divider">
          <span>Admin?</span>
        </div>
        <button className="google-signin-btn" onClick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

export default MaintenancePage
