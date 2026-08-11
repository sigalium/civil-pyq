import { useEffect, useRef } from 'react'

let scriptPromise = null

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })

  return scriptPromise
}

const TurnstileWidget = ({ onVerify, onExpire }) => {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)

  onVerifyRef.current = onVerify
  onExpireRef.current = onExpire

  useEffect(() => {
    let cancelled = false

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        callback: (token) => onVerifyRef.current?.(token),
        'expired-callback': () => onExpireRef.current?.(),
      })
    })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className="turnstile-widget" />
}

export default TurnstileWidget
