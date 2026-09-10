import { useMemo, useState } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { isoToIstParts, istPartsToIso } from '../utils/istDateTime'
import Select from './Select'
import './css/IstDateTimePicker.css'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function buildCalendarGrid(year, month) {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const totalDays = daysInMonth(year, month)
  const prevMonthDays = daysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)

  const cells = []
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({ day: prevMonthDays - i, inMonth: false })
  }
  for (let d = 1; d <= totalDays; d += 1) {
    cells.push({ day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ day: cells.length - (firstWeekday + totalDays) + 1, inMonth: false })
    if (cells.length >= 42) break
  }
  return cells
}

function isBeforeToday(year, month, day, now) {
  if (year !== now.year) return year < now.year
  if (month !== now.month) return month < now.month
  return day < now.day
}

const IstDateTimePicker = ({ value, onChange, children }) => {
  const now = useMemo(() => isoToIstParts(new Date().toISOString()), [])
  const parts = useMemo(() => isoToIstParts(value) || now, [value, now])
  const [viewYear, setViewYear] = useState(parts.year)
  const [viewMonth, setViewMonth] = useState(parts.month)

  const activeYear = viewYear ?? parts.year
  const activeMonth = viewMonth ?? parts.month

  const update = (patch) => {
    const next = { ...parts, ...patch }
    const maxDay = daysInMonth(next.year, next.month)
    if (next.day > maxDay) next.day = maxDay
    onChange(istPartsToIso(next))
  }

  const selectDay = (day) => {
    setViewYear(activeYear)
    setViewMonth(activeMonth)
    const isTodayPick = activeYear === now.year && activeMonth === now.month && day === now.day
    if (isTodayPick && (parts.hour24 < now.hour24 || (parts.hour24 === now.hour24 && parts.minute < now.minute))) {
      update({ year: activeYear, month: activeMonth, day, hour24: now.hour24, minute: now.minute })
    } else {
      update({ year: activeYear, month: activeMonth, day })
    }
  }

  const goToPrevMonth = () => {
    if (activeMonth === 1) {
      setViewYear(activeYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(activeMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (activeMonth === 12) {
      setViewYear(activeYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(activeMonth + 1)
    }
  }

  const cells = useMemo(() => buildCalendarGrid(activeYear, activeMonth), [activeYear, activeMonth])
  const isPastCell = (cell) => cell.inMonth && isBeforeToday(activeYear, activeMonth, cell.day, now)
  const isToday = (cell) => cell.inMonth && activeYear === now.year && activeMonth === now.month && cell.day === now.day
  const selectedIsPast = isBeforeToday(parts.year, parts.month, parts.day, now)
  const isSelected = (cell) => !selectedIsPast && cell.inMonth && activeYear === parts.year && activeMonth === parts.month && cell.day === parts.day
  const isHighlighted = (cell) => isSelected(cell) || (selectedIsPast && isToday(cell))

  const isTodaySelected = !selectedIsPast && parts.year === now.year && parts.month === now.month && parts.day === now.day

  const hour12 = parts.hour24 % 12 === 0 ? 12 : parts.hour24 % 12
  const ampm = parts.hour24 < 12 ? 'AM' : 'PM'

  const setHour12 = (val) => {
    const clamped = val === 0 ? 12 : val
    update({ hour24: (clamped % 12) + (ampm === 'PM' ? 12 : 0) })
  }

  const setMinute = (val) => {
    update({ minute: val })
  }

  const toggleAmPm = (next) => {
    if (next === ampm) return
    const newHour24 = next === 'PM' ? (hour12 % 12) + 12 : hour12 % 12
    update({ hour24: newHour24 })
  }

  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const h = i + 1
    const candidateHour24 = (h % 12) + (ampm === 'PM' ? 12 : 0)
    return { value: h, label: String(h), disabled: isTodaySelected && candidateHour24 < now.hour24 }
  })

  const minuteOptions = Array.from({ length: 60 }, (_, m) => ({
    value: m,
    label: String(m).padStart(2, '0'),
    disabled: isTodaySelected && parts.hour24 === now.hour24 && m < now.minute,
  }))

  const amDisabled = isTodaySelected && now.hour24 >= 12

  return (
    <div className="ist-datetime-picker">
      <div className="ist-calendar">
        <div className="ist-calendar-header">
          <button type="button" className="ist-calendar-nav" onClick={goToPrevMonth} aria-label="Previous month">
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </button>
          <span className="ist-calendar-title">{MONTH_NAMES[activeMonth - 1]} {activeYear}</span>
          <button type="button" className="ist-calendar-nav" onClick={goToNextMonth} aria-label="Next month">
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </button>
        </div>
        <div className="ist-calendar-weekdays">
          {WEEKDAY_NAMES.map((wd) => <span key={wd}>{wd}</span>)}
        </div>
        <div className="ist-calendar-grid">
          {cells.map((cell, i) => (
            <button
              type="button"
              key={i}
              className={`ist-calendar-cell ${cell.inMonth ? '' : 'outside'} ${isPastCell(cell) ? 'past' : ''} ${isHighlighted(cell) ? 'selected' : ''} ${isToday(cell) ? 'today' : ''}`}
              onClick={() => cell.inMonth && !isPastCell(cell) && selectDay(cell.day)}
              disabled={!cell.inMonth || isPastCell(cell)}
            >
              {cell.day}
            </button>
          ))}
        </div>
      </div>

      <div className="ist-side-panel">
        <div className="ist-time-row">
          <Select
            className="ist-time-select"
            value={hour12}
            options={hourOptions}
            onChange={(val) => setHour12(Number(val))}
          />
          <span className="ist-time-colon">:</span>
          <Select
            className="ist-time-select"
            value={parts.minute}
            options={minuteOptions}
            onChange={(val) => setMinute(Number(val))}
          />
          <div className="ist-ampm-toggle">
            <button type="button" className={ampm === 'AM' ? 'active' : ''} disabled={amDisabled} onClick={() => toggleAmPm('AM')}>AM</button>
            <button type="button" className={ampm === 'PM' ? 'active' : ''} onClick={() => toggleAmPm('PM')}>PM</button>
          </div>
        </div>
        <span className="ist-datetime-hint">All times are IST (India), regardless of your device's timezone.</span>
        {children}
      </div>
    </div>
  )
}

export default IstDateTimePicker
