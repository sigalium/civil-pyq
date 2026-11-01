import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import './css/Select.css'

const MENU_GAP = 6
const VIEWPORT_PADDING = 8
const MIN_MENU_HEIGHT = 120
const ESTIMATED_MENU_HEIGHT = 260

const Select = ({ value, onChange, options, placeholder = 'Select...', disabled = false, icon = null, className = '' }) => {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [placement, setPlacement] = useState(null)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const keyboardNavRef = useRef(false)

  const selected = options.find((o) => String(o.value) === String(value))

  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    if (menuRef.current) menuRef.current.style.width = `${rect.width}px`
    const menuHeight = menuRef.current ? Math.min(menuRef.current.scrollHeight, ESTIMATED_MENU_HEIGHT) : ESTIMATED_MENU_HEIGHT
    const spaceBelow = viewportHeight - rect.bottom - MENU_GAP - VIEWPORT_PADDING
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PADDING
    const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow
    const available = Math.max(MIN_MENU_HEIGHT, openUp ? spaceAbove : spaceBelow)
    const next = {
      up: openUp,
      left: rect.left,
      width: rect.width,
      available,
      anchor: openUp ? viewportHeight - rect.top + MENU_GAP : rect.bottom + MENU_GAP,
    }
    setPlacement((prev) => {
      if (
        prev &&
        prev.up === next.up &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.available === next.available &&
        prev.anchor === next.anchor
      ) {
        return prev
      }
      return next
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePlacement()
  }, [open, options.length, updatePlacement])

  useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (event) => {
      const insideTrigger = wrapperRef.current && wrapperRef.current.contains(event.target)
      const insideMenu = menuRef.current && menuRef.current.contains(event.target)
      if (!insideTrigger && !insideMenu) setOpen(false)
    }
    const handleReposition = (event) => {
      if (event && event.type === 'scroll' && menuRef.current && menuRef.current.contains(event.target)) return
      updatePlacement()
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updatePlacement])

  useEffect(() => {
    if (!open || !keyboardNavRef.current) return
    keyboardNavRef.current = false
    const node = menuRef.current?.children[highlighted]
    if (node) node.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  const openMenu = () => {
    if (disabled) return
    const currentIndex = options.findIndex((o) => String(o.value) === String(value))
    setHighlighted(currentIndex >= 0 ? currentIndex : 0)
    setPlacement(null)
    setOpen(true)
  }

  const closeMenu = () => {
    setOpen(false)
    setPlacement(null)
  }

  const pick = (option) => {
    if (option.disabled) return
    onChange(option.value)
    closeMenu()
  }

  const handleOptionMouseDown = (event, option) => {
    event.preventDefault()
    pick(option)
  }

  const handleKeyDown = (event) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'Escape') {
      closeMenu()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      keyboardNavRef.current = true
      setHighlighted((h) => Math.min(h + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      keyboardNavRef.current = true
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (options[highlighted]) pick(options[highlighted])
    }
  }

  const menuStyle = placement
    ? {
        left: placement.left,
        width: placement.width,
        [placement.up ? 'bottom' : 'top']: placement.anchor,
        '--select-available': `${placement.available}px`,
      }
    : { top: 0, left: 0, width: 0, visibility: 'hidden' }

  return (
    <div className={`custom-select ${disabled ? 'disabled' : ''} ${className}`} ref={wrapperRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className="custom-select-trigger"
        onClick={() => (open ? closeMenu() : openMenu())}
        disabled={disabled}
      >
        {icon && <span className="custom-select-icon">{icon}</span>}
        <span className={`custom-select-label ${selected ? '' : 'custom-select-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open &&
        createPortal(
          <div className={`custom-select-portal ${className}`}>
            <ul
              ref={menuRef}
              className={`custom-select-menu ${placement?.up ? 'opens-up' : ''}`}
              role="listbox"
              style={menuStyle}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={String(option.value) === String(value)}
                  aria-disabled={option.disabled || undefined}
                  className={`custom-select-option ${index === highlighted ? 'highlighted' : ''} ${String(option.value) === String(value) ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`}
                  onMouseEnter={() => setHighlighted(index)}
                  onMouseDown={(e) => handleOptionMouseDown(e, option)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}

export default Select
