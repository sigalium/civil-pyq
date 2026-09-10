import { useEffect, useState } from 'react'
import InstallMobileIcon from '@mui/icons-material/InstallMobile'
import CloseIcon from '@mui/icons-material/Close'
import IosShareIcon from '@mui/icons-material/IosShare'
import './css/InstallPrompt.css'

const DISMISS_KEY = 'civilpyq_install_dismissed_at'
const MIN_PDF_OPENS = 3
const DISMISS_COOLDOWN_DAYS = 14

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function readyToShow() {
  if (isStandalone()) return false
  const opens = Number(localStorage.getItem('civilpyq_pdf_opens') || '0')
  if (opens < MIN_PDF_OPENS) return false
  const dismissedAt = localStorage.getItem(DISMISS_KEY)
  if (dismissedAt) {
    const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24)
    if (days < DISMISS_COOLDOWN_DAYS) return false
  }
  return true
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosVariant, setIosVariant] = useState(false)

  useEffect(() => {
    if (isIos()) {
      if (readyToShow()) {
        setIosVariant(true)
        setVisible(true)
      }
      return
    }

    const handler = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      if (readyToShow()) setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="install-prompt">
      <button className="install-prompt-close" onClick={dismiss} aria-label="Dismiss">
        <CloseIcon sx={{ fontSize: 16 }} />
      </button>
      {iosVariant ? (
        <>
          <IosShareIcon sx={{ fontSize: 22, color: 'var(--accent)' }} />
          <div>
            <p className="install-prompt-title">Add CivilPYQ to your Home Screen</p>
            <p className="install-prompt-hint">Tap the Share button, then "Add to Home Screen" for quick, app-like access.</p>
          </div>
        </>
      ) : (
        <>
          <InstallMobileIcon sx={{ fontSize: 22, color: 'var(--accent)' }} />
          <div>
            <p className="install-prompt-title">Install CivilPYQ</p>
            <p className="install-prompt-hint">Add it to your device for quicker access and offline papers.</p>
          </div>
          <button className="install-prompt-btn" onClick={install}>Install</button>
        </>
      )}
    </div>
  )
}

export default InstallPrompt
