import { useEffect, useState } from 'react'

const PositionInput = ({ position, total, onMove }) => {
  const [value, setValue] = useState(String(position))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setValue(String(position))
  }, [position, focused])

  const commit = () => {
    setFocused(false)
    const parsed = parseInt(value, 10)
    if (!Number.isFinite(parsed)) {
      setValue(String(position))
      return
    }
    const clamped = Math.min(Math.max(parsed, 1), total)
    setValue(String(clamped))
    if (clamped !== position) onMove(clamped)
  }

  return (
    <input
      type="number"
      className="resource-position-input"
      min={1}
      max={total}
      value={value}
      onFocus={(e) => { setFocused(true); e.target.select() }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      onClick={(e) => e.stopPropagation()}
      title="Move to position"
      aria-label="Position"
    />
  )
}

export default PositionInput
