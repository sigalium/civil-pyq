import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildTourSteps } from '../utils/dashboardTour'
import './css/DashboardTour.css'

const PAD = 6
const GAP = 14
const MARGIN = 12
const DEFAULT_WIDTH = 340

function targetRect(ids) {
  const boxes = ids
    .map((id) => document.querySelector(`[data-tour="${id}"]`))
    .filter(Boolean)
    .map((node) => node.getBoundingClientRect())
  if (!boxes.length) return null
  const left = Math.max(4, Math.min(...boxes.map((b) => b.left)) - PAD)
  const top = Math.max(4, Math.min(...boxes.map((b) => b.top)) - PAD)
  const right = Math.min(window.innerWidth - 4, Math.max(...boxes.map((b) => b.right)) + PAD)
  const bottom = Math.max(...boxes.map((b) => b.bottom)) + PAD
  return { left, top, width: right - left, height: bottom - top }
}

const DashboardTour = ({ visibleTabs, onFinish }) => {
  const key = visibleTabs.join(',')
  const steps = useMemo(() => buildTourSteps(key ? key.split(',') : []), [key])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardSize, setCardSize] = useState({ w: DEFAULT_WIDTH, h: 0 })
  const cardRef = useRef(null)
  const nextRef = useRef(null)
  const step = steps[index]
  const last = index === steps.length - 1

  const next = useCallback(() => {
    if (last) onFinish()
    else setIndex((value) => value + 1)
  }, [last, onFinish])

  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), [])

  useLayoutEffect(() => {
    const first = step.targets[0] && document.querySelector(`[data-tour="${step.targets[0]}"]`)
    if (first) first.scrollIntoView({ block: 'nearest', inline: 'center' })
    const measure = () => setRect(step.targets.length ? targetRect(step.targets) : null)
    measure()
    const settle = setTimeout(measure, 280)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(settle)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  useLayoutEffect(() => {
    const node = cardRef.current
    if (node) setCardSize({ w: node.offsetWidth, h: node.offsetHeight })
  }, [index])

  useEffect(() => {
    if (nextRef.current) nextRef.current.focus()
  }, [index])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onFinish()
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, onFinish])

  let cardStyle
  if (rect) {
    const width = Math.min(cardSize.w || DEFAULT_WIDTH, window.innerWidth - MARGIN * 2)
    const spaceBelow = window.innerHeight - (rect.top + rect.height) - GAP - MARGIN
    const spaceAbove = rect.top - GAP - MARGIN
    const placeBelow = spaceBelow >= cardSize.h || spaceBelow >= spaceAbove
    const top = placeBelow ? rect.top + rect.height + GAP : rect.top - GAP - cardSize.h
    const left = Math.max(MARGIN, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - MARGIN))
    cardStyle = { top: Math.max(MARGIN, top), left }
  }

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Dashboard tour">
      <div className="tour-blocker" />
      {rect ? (
        <div className="tour-hole" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={cardRef} className={`tour-card${rect ? '' : ' centered'}`} style={cardStyle}>
        <div className="tour-meta">
          <div className="tour-dots" aria-hidden="true">
            {steps.map((item, i) => (
              <span key={item.id} className={i === index ? 'on' : i < index ? 'done' : ''} />
            ))}
          </div>
          <span className="tour-count">
            {index + 1} / {steps.length}
          </span>
        </div>
        <h3 className="tour-title">{step.title}</h3>
        {step.text && <p className="tour-text">{step.text}</p>}
        {step.items.length > 0 && (
          <ul className="tour-list">
            {step.items.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="tour-actions">
          {!last && (
            <button type="button" className="tour-btn ghost" onClick={onFinish}>
              Skip
            </button>
          )}
          <span className="tour-spacer" />
          {index > 0 && (
            <button type="button" className="tour-btn" onClick={back}>
              Back
            </button>
          )}
          <button type="button" ref={nextRef} className="tour-btn primary" onClick={next}>
            {last ? 'Done' : index === 0 ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DashboardTour
