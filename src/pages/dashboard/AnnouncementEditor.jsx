import { useLayoutEffect, useReducer, useRef, useState } from 'react'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import CodeIcon from '@mui/icons-material/Code'
import LinkIcon from '@mui/icons-material/Link'
import SmartButtonIcon from '@mui/icons-material/SmartButton'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease'
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CampaignIcon from '@mui/icons-material/Campaign'
import AnnouncementBody from '../../components/AnnouncementBody'
import { sanitizeUrl } from '../../utils/announcementMarkdown'
import '../styles/UserLists.css'
import './AnnouncementEditor.css'

const LIST_ITEM = /^(\s*)([-*+]|(\d+)([.)]))\s+(.*)$/
const BULLET_ITEM = /^(\s*)[-*+]\s+/
const NUMBER_ITEM = /^(\s*)\d+[.)]\s+/

function lineRange(text, start, end) {
  const from = text.lastIndexOf('\n', start - 1) + 1
  let to = text.indexOf('\n', end)
  if (to === -1) to = text.length
  return { from, to }
}

const AnnouncementEditor = ({ title, onTitleChange, underline, onUnderlineChange, message, onMessageChange, maxMessage, disabled }) => {
  const textareaRef = useRef(null)
  const pendingSelection = useRef(null)
  const [, bump] = useReducer((n) => n + 1, 0)
  const [popover, setPopover] = useState(null)
  const [pane, setPane] = useState('write')

  useLayoutEffect(() => {
    const target = pendingSelection.current
    const textarea = textareaRef.current
    if (!target || !textarea) return
    pendingSelection.current = null
    textarea.focus()
    textarea.setSelectionRange(target.start, target.end)
  })

  const commit = (text, start, end) => {
    pendingSelection.current = { start, end }
    onMessageChange(text.slice(0, maxMessage))
    bump()
  }

  const selection = () => {
    const textarea = textareaRef.current
    return { start: textarea.selectionStart, end: textarea.selectionEnd }
  }

  const wrap = (prefix, suffix, placeholder) => {
    const { start, end } = selection()
    const selected = message.slice(start, end)
    const before = message.slice(0, start)
    const after = message.slice(end)
    if (selected && before.endsWith(prefix) && after.startsWith(suffix)) {
      commit(before.slice(0, -prefix.length) + selected + after.slice(suffix.length), start - prefix.length, end - prefix.length)
      return
    }
    const inner = selected || placeholder
    commit(before + prefix + inner + suffix + after, start + prefix.length, start + prefix.length + inner.length)
  }

  const editLines = (transform) => {
    const { start, end } = selection()
    const { from, to } = lineRange(message, start, end)
    const lines = message.slice(from, to).split('\n')
    const original = message.slice(from, to)
    const next = transform(lines).join('\n')
    const text = message.slice(0, from) + next + message.slice(to)
    if (start === end) {
      const caret = Math.max(from, Math.min(from + next.length, start + next.length - original.length))
      commit(text, caret, caret)
      return
    }
    commit(text, from, from + next.length)
  }

  const toggleBullets = () =>
    editLines((lines) => {
      const allBullets = lines.every((line) => BULLET_ITEM.test(line))
      return lines.map((line) => {
        const stripped = line.replace(/^(\s*)([-*+]|\d+[.)])\s+/, '$1')
        if (allBullets) return stripped
        const indent = /^\s*/.exec(stripped)[0]
        return `${indent}- ${stripped.slice(indent.length)}`
      })
    })

  const toggleNumbers = () =>
    editLines((lines) => {
      const allNumbers = lines.every((line) => NUMBER_ITEM.test(line))
      return lines.map((line, index) => {
        const stripped = line.replace(/^(\s*)([-*+]|\d+[.)])\s+/, '$1')
        if (allNumbers) return stripped
        const indent = /^\s*/.exec(stripped)[0]
        return `${indent}${index + 1}. ${stripped.slice(indent.length)}`
      })
    })

  const indent = () => editLines((lines) => lines.map((line) => `  ${line}`))
  const outdent = () => editLines((lines) => lines.map((line) => line.replace(/^ {1,2}/, '')))

  const openPopover = (kind) => {
    const { start, end } = selection()
    setPopover({ kind, start, end, text: message.slice(start, end), url: '' })
  }

  const applyPopover = () => {
    if (!popover) return
    const href = sanitizeUrl(popover.url)
    const label = popover.text.trim() || (popover.kind === 'button' ? 'Open' : popover.url.trim())
    if (!href) return
    const snippet = popover.kind === 'button' ? `[[button: ${label} | ${href}]]` : `[${label}](${href})`
    const text = message.slice(0, popover.start) + snippet + message.slice(popover.end)
    const caret = popover.start + snippet.length
    setPopover(null)
    commit(text, caret, caret)
  }

  const handleKeyDown = (event) => {
    const { start, end } = selection()
    const modifier = event.ctrlKey || event.metaKey
    if (modifier && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      wrap('**', '**', 'bold text')
      return
    }
    if (modifier && event.key.toLowerCase() === 'i') {
      event.preventDefault()
      wrap('*', '*', 'italic text')
      return
    }
    if (modifier && event.key.toLowerCase() === 'u') {
      event.preventDefault()
      wrap('++', '++', 'underlined text')
      return
    }
    const { from, to } = lineRange(message, start, end)
    const currentLine = message.slice(from, to)
    const item = LIST_ITEM.exec(currentLine)
    if (event.key === 'Tab' && item) {
      event.preventDefault()
      if (event.shiftKey) outdent()
      else indent()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && !modifier && start === end && item && start === to) {
      event.preventDefault()
      if (!item[5].trim()) {
        commit(message.slice(0, from) + message.slice(to), from, from)
        return
      }
      const marker = item[3] ? `${Number(item[3]) + 1}${item[4]}` : item[2]
      const insert = `\n${item[1]}${marker} `
      commit(message.slice(0, start) + insert + message.slice(end), start + insert.length, start + insert.length)
    }
  }

  const popoverValid = popover ? !!sanitizeUrl(popover.url) : false

  const tools = [
    { key: 'bold', label: 'Bold (Ctrl+B)', Icon: FormatBoldIcon, run: () => wrap('**', '**', 'bold text') },
    { key: 'italic', label: 'Italic (Ctrl+I)', Icon: FormatItalicIcon, run: () => wrap('*', '*', 'italic text') },
    { key: 'underline', label: 'Underline (Ctrl+U)', Icon: FormatUnderlinedIcon, run: () => wrap('++', '++', 'underlined text') },
    { key: 'code', label: 'Code', Icon: CodeIcon, run: () => wrap('`', '`', 'code') },
    { divider: true, key: 'd1' },
    { key: 'link', label: 'Link', Icon: LinkIcon, run: () => openPopover('link') },
    { key: 'button', label: 'Button', Icon: SmartButtonIcon, run: () => openPopover('button') },
    { divider: true, key: 'd2' },
    { key: 'bullets', label: 'Bulleted list', Icon: FormatListBulletedIcon, run: toggleBullets },
    { key: 'numbers', label: 'Numbered list', Icon: FormatListNumberedIcon, run: toggleNumbers },
    { key: 'indent', label: 'Indent (Tab)', Icon: FormatIndentIncreaseIcon, run: indent },
    { key: 'outdent', label: 'Outdent (Shift+Tab)', Icon: FormatIndentDecreaseIcon, run: outdent },
  ]

  return (
    <div className="ann-editor">
      <div className="ann-title-row">
        <input
          type="text"
          className="ann-title-input"
          value={title}
          maxLength={80}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          disabled={disabled}
        />
        <button
          type="button"
          className={`ann-chip ${underline ? 'on' : ''}`}
          aria-pressed={underline}
          onClick={() => onUnderlineChange(!underline)}
          disabled={disabled}
          title="Draw a line under the title"
        >
          <FormatUnderlinedIcon sx={{ fontSize: 16 }} /> Title line
        </button>
      </div>

      <div className="ann-toolbar" role="toolbar" aria-label="Formatting">
        {tools.map((tool) =>
          tool.divider ? (
            <span className="ann-divider" key={tool.key} />
          ) : (
            <button
              type="button"
              key={tool.key}
              className="ann-tool"
              title={tool.label}
              aria-label={tool.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={tool.run}
              disabled={disabled}
            >
              <tool.Icon sx={{ fontSize: 18 }} />
            </button>
          )
        )}
        <button
          type="button"
          className={`ann-tool ann-pane-toggle ${pane === 'preview' ? 'on' : ''}`}
          title="Preview"
          aria-label="Toggle preview"
          aria-pressed={pane === 'preview'}
          onClick={() => setPane((p) => (p === 'write' ? 'preview' : 'write'))}
        >
          <VisibilityIcon sx={{ fontSize: 18 }} />
        </button>
        <span className="ann-counter">{message.length}/{maxMessage}</span>

        {popover && (
          <div className="ann-popover">
            <input
              type="text"
              className="ann-popover-input"
              value={popover.text}
              onChange={(e) => setPopover({ ...popover, text: e.target.value })}
              placeholder={popover.kind === 'button' ? 'Button label' : 'Link text'}
              autoFocus={popover.kind === 'button' || !popover.text}
            />
            <input
              type="text"
              className="ann-popover-input url"
              value={popover.url}
              onChange={(e) => setPopover({ ...popover, url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyPopover()
                }
              }}
              placeholder="https://"
              autoFocus={!!popover.text && popover.kind === 'link'}
            />
            <button type="button" className="ann-popover-add" disabled={!popoverValid} onClick={applyPopover}>
              Add
            </button>
            <button type="button" className="ann-popover-cancel" onClick={() => setPopover(null)} aria-label="Cancel">
              ×
            </button>
          </div>
        )}
      </div>

      <div className={`ann-panes ${pane}`}>
        <textarea
          ref={textareaRef}
          className="ann-textarea"
          value={message}
          maxLength={maxMessage}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your announcement. Markdown works too."
          disabled={disabled}
          rows={9}
        />
        <div className="ann-preview" aria-label="Preview">
          <div className="user-list-item notification-item announcement">
            <span className="notification-icon">
              <CampaignIcon sx={{ fontSize: 20 }} />
            </span>
            <div className="user-list-body">
              <div className={`notification-head${underline ? ' has-title-rule' : ''}`}>
                <strong>{title.trim() || 'Title'}</strong>
              </div>
              {message.trim() ? <AnnouncementBody source={message} /> : <p className="ann-preview-empty">Your message appears here.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnnouncementEditor
