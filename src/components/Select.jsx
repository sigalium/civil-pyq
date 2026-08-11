import { useEffect, useRef, useState } from 'react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import './css/Select.css'

const Select = ({ value, onChange, options, placeholder = 'Select...', disabled = false }) => {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapperRef = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value))

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openMenu = () => {
    if (disabled) return
    const currentIndex = options.findIndex((o) => String(o.value) === String(value))
    setHighlighted(currentIndex >= 0 ? currentIndex : 0)
    setOpen(true)
  }

  const pick = (option) => {
    onChange(option.value)
    setOpen(false)
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
      setOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((h) => Math.min(h + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (options[highlighted]) pick(options[highlighted])
    }
  }

  return (
    <div className={`custom-select ${disabled ? 'disabled' : ''}`} ref={wrapperRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
      >
        <span className={selected ? '' : 'custom-select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <ul className="custom-select-menu" role="listbox">
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={String(option.value) === String(value)}
              className={`custom-select-option ${index === highlighted ? 'highlighted' : ''} ${String(option.value) === String(value) ? 'selected' : ''}`}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(e) => handleOptionMouseDown(e, option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Select
