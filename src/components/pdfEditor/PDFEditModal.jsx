import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CloseIcon from '@mui/icons-material/Close'
import TuneIcon from '@mui/icons-material/Tune'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import ReplayIcon from '@mui/icons-material/Replay'
import { COMPRESSION_PRESETS, formatBytes } from '../../utils/pdfCompression'
import { MAX_FILE_BYTES } from '../../utils/githubUpload'
import { exportDocument } from '../../utils/pdfEditor/exportPdf'
import { createImageSource, createPdfSource, destroySource } from '../../utils/pdfEditor/sources'
import { findBlankPages } from '../../utils/pdfEditor/blankScan'
import { straightenPages } from '../../utils/pdfEditor/autoTools'
import { MAX_EDITOR_PAGES, isTouchDevice } from '../../utils/pdfEditor/capability'
import { DEFAULT_STAMPS, sanitizeWatermark, stampsActive } from '../../utils/pdfEditor/stamps'
import { DESKTOP_MAX_PIXELS, MOBILE_MAX_PIXELS } from '../../utils/pdfEditor/exportPdf'
import {
  commitHistory,
  createBlankPage,
  createHistory,
  deletePages,
  duplicatePages,
  insertPagesAt,
  keepPages,
  movePagesBy,
  movePagesTo,
  pagesFromSource,
  redoHistory,
  rotatePages,
  setAnnotationsFor,
  setCropFor,
  setFilterFor,
  setSkewFor,
  undoHistory,
} from '../../utils/pdfEditor/model'
import PDFEditThumb from './PDFEditThumb'
import PDFCropEditor from './PDFCropEditor'
import PDFAnnotateEditor from './PDFAnnotateEditor'
import PDFPageViewer from './PDFPageViewer'
import PDFEditToolbar from './PDFEditToolbar'
import PDFEditSidebar from './PDFEditSidebar'
import '../css/PDFEditModal.css'

const COMPRESSION_OPTIONS = [
  { key: 'none', label: 'None', detail: 'Keeps text sharp' },
  ...Object.entries(COMPRESSION_PRESETS).map(([key, preset]) => ({
    key,
    label: preset.label.replace(' compression', ''),
    detail: `${preset.dpi} DPI`,
  })),
]

const historyReducer = (state, action) => {
  switch (action.type) {
    case 'init':
      return createHistory(action.pages)
    case 'commit':
      return commitHistory(state, action.pages)
    case 'rewind': {
      if (state.past.length <= action.length) return state
      let next = state
      while (next.past.length > action.length) next = undoHistory(next)
      return { ...next, future: [] }
    }
    case 'undo':
      return undoHistory(state)
    case 'redo':
      return redoHistory(state)
    default:
      return state
  }
}

const THUMB_MIN = 100
const GRID_CHROME = 56

const isPdfFile = (candidate) => candidate.type === 'application/pdf' || /\.pdf$/i.test(candidate.name)

const PDFEditModal = ({ file, initialResult, onApply, onClose, onUseCompression }) => {
  const baseFile = initialResult || file
  const [history, dispatch] = useReducer(historyReducer, null, () => createHistory([]))
  const [sources, setSources] = useState(() => new Map())
  const [loadState, setLoadState] = useState({ status: 'loading', message: '' })
  const [selected, setSelected] = useState([])
  const [thumbSize, setThumbSize] = useState(() => (window.innerWidth <= 900 ? 130 : 180))
  const [gridWidth, setGridWidth] = useState(0)
  const [cropPageId, setCropPageId] = useState(null)
  const [annotatePageId, setAnnotatePageId] = useState(null)
  const [viewPageId, setViewPageId] = useState(null)
  const [presetKey, setPresetKey] = useState('none')
  const [built, setBuilt] = useState(null)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [buildError, setBuildError] = useState('')
  const [busyLabel, setBusyLabel] = useState('')
  const [notice, setNotice] = useState('')
  const [dropMark, setDropMark] = useState(null)
  const [fileDragActive, setFileDragActive] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [scrollRoot, setScrollRoot] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)
  const [sideTab, setSideTab] = useState('enhance')
  const [stamps, setStamps] = useState(DEFAULT_STAMPS)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [touch] = useState(isTouchDevice)

  const mountedRef = useRef(true)
  const annotateBaselineRef = useRef(0)
  const sourcesRef = useRef(sources)
  const pagesRef = useRef([])
  const selectedRef = useRef([])
  const anchorRef = useRef(null)
  const dragIdsRef = useRef([])
  const fileInputRef = useRef(null)
  const latestRef = useRef({})
  const viewPageIdRef = useRef(null)

  const pages = history.present
  const pageIds = useMemo(() => new Set(pages.map((page) => page.id)), [pages])
  const activeSelected = useMemo(() => selected.filter((id) => pageIds.has(id)), [selected, pageIds])
  const selectedSet = useMemo(() => new Set(activeSelected), [activeSelected])
  const targetIds = activeSelected.length ? activeSelected : pages.map((page) => page.id)
  const stampsKey = JSON.stringify(stamps)
  const dirty = history.past.length > 0 || presetKey !== 'none' || stampsActive(stamps)
  const ready = loadState.status === 'ready'
  const working = building || !!busyLabel

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sourcesRef.current.forEach(destroySource)
    }
  }, [])

  useEffect(() => {
    sourcesRef.current = sources
  }, [sources])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!scrollRoot) return undefined
    const measure = () => setGridWidth(scrollRoot.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scrollRoot)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    pagesRef.current = pages
    selectedRef.current = activeSelected
  }, [pages, activeSelected])

  useEffect(() => {
    viewPageIdRef.current = viewPageId
  }, [viewPageId])

  useEffect(() => {
    if (viewPageId && !pages.some((page) => page.id === viewPageId)) setViewPageId(null)
  }, [pages, viewPageId])

  useEffect(() => {
    let cancelled = false
    createPdfSource(baseFile)
      .then((source) => {
        if (cancelled) {
          destroySource(source)
          return
        }
        const initialPages = pagesFromSource(source)
        if (initialPages.length > MAX_EDITOR_PAGES) {
          destroySource(source)
          setLoadState({ status: 'error', message: 'This PDF has too many pages for the editor.' })
          return
        }
        setSources(new Map([[source.id, source]]))
        dispatch({ type: 'init', pages: initialPages })
        setLoadState({ status: 'ready', message: '' })
      })
      .catch((error) => {
        if (cancelled) return
        const locked = error && error.name === 'PasswordException'
        setLoadState({
          status: 'error',
          message: locked ? 'This PDF is password protected and cannot be edited.' : 'Could not open this PDF.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [baseFile])

  const commit = useCallback((nextPages) => dispatch({ type: 'commit', pages: nextPages }), [])

  const handleSelect = useCallback((id, { additive: wantsAdditive, range }) => {
    const additive = wantsAdditive || touch
    const order = pagesRef.current.map((page) => page.id)
    const useRange = range && anchorRef.current && order.includes(anchorRef.current)
    if (!useRange) anchorRef.current = id
    const anchor = anchorRef.current
    setSelected((previous) => {
      if (useRange) {
        const from = order.indexOf(anchor)
        const to = order.indexOf(id)
        const slice = order.slice(Math.min(from, to), Math.max(from, to) + 1)
        return additive ? Array.from(new Set([...previous, ...slice])) : slice
      }
      if (additive) return previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
      return previous.length === 1 && previous[0] === id ? previous : [id]
    })
  }, [touch])

  const rotateOne = useCallback((id, delta) => commit(rotatePages(pagesRef.current, [id], delta)), [commit])
  const deleteOne = useCallback(
    (id) => {
      if (pagesRef.current.length <= 1) return
      commit(deletePages(pagesRef.current, [id]))
    },
    [commit]
  )

  const deleteFromViewer = useCallback(
    (id) => {
      const list = pagesRef.current
      if (list.length <= 1) return
      const position = list.findIndex((page) => page.id === id)
      const fallback = list[position + 1] || list[position - 1]
      commit(deletePages(list, [id]))
      setViewPageId(fallback ? fallback.id : null)
    },
    [commit]
  )
  const openCropFor = useCallback((id) => setCropPageId(id), [])
  const openViewFor = useCallback((id) => setViewPageId(id), [])

  const rotateTargets = (delta) => commit(rotatePages(pages, targetIds, delta))

  const duplicateSelected = () => {
    if (!activeSelected.length) return
    commit(duplicatePages(pages, activeSelected))
  }

  const deleteSelected = () => {
    if (!activeSelected.length || activeSelected.length >= pages.length) return
    commit(deletePages(pages, activeSelected))
    setSelected([])
  }

  const keepSelected = () => {
    if (!activeSelected.length || activeSelected.length >= pages.length) return
    commit(keepPages(pages, activeSelected))
  }

  const moveSelected = (direction) => {
    if (!activeSelected.length) return
    commit(movePagesBy(pages, activeSelected, direction))
  }

  const insertionIndex = () => {
    if (!activeSelected.length) return pages.length
    let last = -1
    pages.forEach((page, index) => {
      if (selectedSet.has(page.id)) last = index
    })
    return last + 1
  }

  const insertBlank = () => {
    const index = insertionIndex()
    const reference = pages[Math.max(0, index - 1)]
    const blank = createBlankPage(reference)
    commit(insertPagesAt(pages, [blank], index))
    setSelected([blank.id])
  }

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setBusyLabel('Adding files…')
    setNotice('')
    const created = []
    const failed = []
    for (const candidate of files) {
      try {
        if (isPdfFile(candidate)) created.push(await createPdfSource(candidate))
        else if (candidate.type.startsWith('image/')) created.push(await createImageSource(candidate))
        else failed.push(candidate.name)
      } catch {
        failed.push(candidate.name)
      }
    }
    if (!mountedRef.current) {
      created.forEach(destroySource)
      return
    }
    const incomingPages = created.flatMap(pagesFromSource)
    if (created.length && pagesRef.current.length + incomingPages.length > MAX_EDITOR_PAGES) {
      created.forEach(destroySource)
      setNotice(`The editor is limited to ${MAX_EDITOR_PAGES} pages.`)
      setBusyLabel('')
      return
    }
    if (created.length) {
      setSources((previous) => {
        const next = new Map(previous)
        created.forEach((source) => next.set(source.id, source))
        return next
      })
      const incoming = incomingPages
      commit(insertPagesAt(pagesRef.current, incoming, insertionIndex()))
      setSelected(incoming.map((page) => page.id))
    }
    if (failed.length) setNotice(`Could not add: ${failed.join(', ')}`)
    setBusyLabel('')
  }

  const startOver = async () => {
    setBusyLabel('Reloading original…')
    setNotice('')
    try {
      const source = await createPdfSource(file)
      if (!mountedRef.current) {
        destroySource(source)
        return
      }
      setSources((previous) => new Map(previous).set(source.id, source))
      commit(pagesFromSource(source))
      setSelected([])
    } catch {
      setNotice('Could not reload the original.')
    }
    if (mountedRef.current) setBusyLabel('')
  }

  const handleDragStart = useCallback((event, id) => {
    const ids = selectedRef.current.includes(id) ? selectedRef.current : [id]
    dragIdsRef.current = ids
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', 'pages')
  }, [])

  const dropSideFor = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'
  }

  const handleThumbDragOver = useCallback((event, index) => {
    if (!dragIdsRef.current.length) return
    event.preventDefault()
    event.stopPropagation()
    const side = dropSideFor(event)
    setDropMark((previous) => (previous && previous.index === index && previous.side === side ? previous : { index, side }))
  }, [])

  const handleThumbDrop = useCallback(
    (event, index) => {
      if (!dragIdsRef.current.length) return
      event.preventDefault()
      event.stopPropagation()
      const side = dropSideFor(event)
      commit(movePagesTo(pagesRef.current, dragIdsRef.current, side === 'before' ? index : index + 1))
      dragIdsRef.current = []
      setDropMark(null)
    },
    [commit]
  )

  const handleDragEnd = useCallback(() => {
    dragIdsRef.current = []
    setDropMark(null)
  }, [])

  const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')

  const handleGridDragOver = (event) => {
    if (dragIdsRef.current.length || !hasFiles(event)) return
    event.preventDefault()
    setFileDragActive(true)
  }

  const handleGridDrop = (event) => {
    if (dragIdsRef.current.length || !hasFiles(event)) return
    event.preventDefault()
    setFileDragActive(false)
    addFiles(event.dataTransfer.files)
  }

  const handleGridClick = (event) => {
    if (event.target === event.currentTarget) setSelected([])
  }

  const viewIndex = viewPageId ? pages.findIndex((page) => page.id === viewPageId) : -1
  const viewPage = viewIndex >= 0 ? pages[viewIndex] : null

  const navigateView = useCallback((direction) => {
    const list = pagesRef.current
    const current = list.findIndex((page) => page.id === viewPageIdRef.current)
    const next = list[current + direction]
    if (next) setViewPageId(next.id)
  }, [])

  const cropIndex = cropPageId ? pages.findIndex((page) => page.id === cropPageId) : -1
  const cropPage = cropIndex >= 0 ? pages[cropIndex] : null

  const openCrop = () => {
    const first = pages.find((page) => targetIds.includes(page.id))
    if (first) setCropPageId(first.id)
  }

  const navigateCrop = (direction) => {
    const next = pages[cropIndex + direction]
    if (next) setCropPageId(next.id)
  }

  const applyCrop = (scope, rect, advance) => {
    const ids = scope === 'all' ? pages.map((page) => page.id) : scope === 'selected' ? activeSelected : [cropPageId]
    commit(setCropFor(pages, ids, rect))
    if (advance) navigateCrop(1)
    else setCropPageId(null)
  }

  const annotateIndex = annotatePageId ? pages.findIndex((page) => page.id === annotatePageId) : -1
  const annotatePage = annotateIndex >= 0 ? pages[annotateIndex] : null

  const cancelAnnotate = useCallback(() => {
    dispatch({ type: 'rewind', length: annotateBaselineRef.current })
    setAnnotatePageId(null)
  }, [])

  const openAnnotate = () => {
    annotateBaselineRef.current = history.past.length
    const first = pages.find((page) => activeSelected.includes(page.id)) || pages[0]
    if (first) setAnnotatePageId(first.id)
  }

  const openAnnotateFor = (id) => {
    annotateBaselineRef.current = history.past.length
    setAnnotatePageId(id)
  }

  const navigateAnnotate = (direction) => {
    const next = pages[annotateIndex + direction]
    if (next) setAnnotatePageId(next.id)
  }

  const changeAnnotations = useCallback((id, annotations) => commit(setAnnotationsFor(pagesRef.current, id, annotations)), [commit])

  const applyFilter = (key) => commit(setFilterFor(pages, targetIds, key))

  const scanBlank = async () => {
    setBusyLabel('Scanning pages…')
    setNotice('')
    try {
      const blank = await findBlankPages(pages, sources, (done, total) => {
        if (mountedRef.current) setBusyLabel(`Scanning ${done}/${total}`)
      })
      if (!mountedRef.current) return
      setSelected(blank)
      setNotice(blank.length ? `${blank.length} blank page${blank.length === 1 ? '' : 's'} selected.` : 'No blank pages found.')
    } catch {
      if (mountedRef.current) setNotice('Could not scan pages.')
    }
    if (mountedRef.current) setBusyLabel('')
  }

  const straighten = async () => {
    setBusyLabel('Straightening…')
    setNotice('')
    try {
      const corrections = await straightenPages(pages, targetIds, sources, (done, total) => {
        if (mountedRef.current) setBusyLabel(`Straightening ${done}/${total}`)
      })
      if (!mountedRef.current) return
      const changed = pages.filter((page) => corrections.has(page.id) && corrections.get(page.id) !== page.skew).length
      if (changed) {
        commit(setSkewFor(pagesRef.current, corrections))
        setNotice(`Straightened ${changed} page${changed === 1 ? '' : 's'}.`)
      } else {
        setNotice('No tilt found.')
      }
    } catch {
      if (mountedRef.current) setNotice('Could not straighten pages.')
    }
    if (mountedRef.current) setBusyLabel('')
  }

  const updateNumbers = (patch) => setStamps((previous) => ({ ...previous, numbers: { ...previous.numbers, ...patch } }))
  const updateWatermark = (patch) => {
    const next = patch.text === undefined ? patch : { ...patch, text: sanitizeWatermark(patch.text) }
    setStamps((previous) => ({ ...previous, watermark: { ...previous.watermark, ...next } }))
  }

  const firstTarget = pages.find((page) => targetIds.includes(page.id)) || null
  const targetFilters = new Set(pages.filter((page) => targetIds.includes(page.id)).map((page) => page.filter))
  const activeFilter = targetFilters.size === 1 ? Array.from(targetFilters)[0] : null
  const hasFilteredPages = pages.some((page) => page.filter !== 'original')

  const builtCurrent = !!built && built.pages === pages && built.presetKey === presetKey && built.stampsKey === stampsKey

  const build = useCallback(async () => {
    setBuilding(true)
    setBuildError('')
    setProgress({ done: 0, total: pages.length })
    try {
      const preset = presetKey === 'none' ? null : COMPRESSION_PRESETS[presetKey]
      const result = await exportDocument({
        pages,
        sources,
        preset,
        name: file.name,
        stamps,
        maxPixels: compact || touch ? MOBILE_MAX_PIXELS : DESKTOP_MAX_PIXELS,
        onProgress: (done, total) => {
          if (mountedRef.current) setProgress({ done, total })
        },
      })
      if (mountedRef.current) setBuilt({ pages, presetKey, stampsKey, file: result })
      return result
    } catch {
      if (mountedRef.current) setBuildError('Could not build the PDF.')
      return null
    } finally {
      if (mountedRef.current) setBuilding(false)
    }
  }, [pages, presetKey, sources, file.name, stamps, stampsKey, compact, touch])

  const handleApply = async () => {
    const result = builtCurrent ? built.file : await build()
    if (!result) return
    if (result.size > MAX_FILE_BYTES) {
      setBuildError(`Result exceeds the ${formatBytes(MAX_FILE_BYTES)} limit.`)
      return
    }
    onApply(result, { edited: history.past.length > 0 || stampsActive(stamps), compressed: presetKey !== 'none' })
  }

  const requestClose = useCallback(() => {
    if (working) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose, working])

  useEffect(() => {
    latestRef.current = {
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      selectAll: () => setSelected(pagesRef.current.map((page) => page.id)),
      deleteSelected,
      requestClose,
      cropping: !!cropPage,
      annotating: !!annotatePage,
      viewing: !!viewPage,
      closeView: () => setViewPageId(null),
      navigateView,
      cancelAnnotate,
      closeCrop: () => {
        setCropPageId(null)
        setAnnotatePageId(null)
      },
      ready,
    }
  })

  useEffect(() => {
    const handleKey = (event) => {
      const latest = latestRef.current
      const tag = event.target && event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = event.ctrlKey || event.metaKey
      if (event.key === 'Escape') {
        event.preventDefault()
        if (latest.annotating) latest.cancelAnnotate()
        else if (latest.cropping) latest.closeCrop()
        else if (latest.viewing) latest.closeView()
        else latest.requestClose()
        return
      }
      if (!latest.ready || latest.cropping) return
      if (latest.viewing && !latest.annotating) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          latest.navigateView(-1)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          latest.navigateView(1)
        }
        if (!(mod && ['z', 'y'].includes(event.key.toLowerCase()))) return
      }
      if (latest.annotating && !(mod && ['z', 'y'].includes(event.key.toLowerCase()))) return
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) latest.redo()
        else latest.undo()
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        latest.redo()
      } else if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        latest.selectAll()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        latest.deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const thumbMax = Math.max(THUMB_MIN + 40, (gridWidth || 360) - GRID_CHROME)
  const effectiveThumb = Math.min(thumbSize, thumbMax)
  const resultText = building
    ? `Page ${progress.done}/${progress.total || '…'}`
    : builtCurrent
      ? `${formatBytes(built.file.size)} (${built.file.size <= file.size ? `${Math.round((1 - built.file.size / file.size) * 100)}% smaller` : `${Math.round((built.file.size / file.size - 1) * 100)}% larger`})`
      : 'Not checked'
  const resultLarger = builtCurrent && built.file.size >= file.size
  const resultTooBig = builtCurrent && built.file.size > MAX_FILE_BYTES
  const hasSelection = activeSelected.length > 0
  const canRemove = hasSelection && activeSelected.length < pages.length
  const editing = !!(cropPage || annotatePage)
  const covered = editing || !!viewPage
  const canApply = dirty && !working && !resultTooBig

  const renderGrid = () => (
    <div
      className={`pe-grid-scroll ${fileDragActive ? 'file-drag' : ''}`}
      ref={setScrollRoot}
      onClick={handleGridClick}
      onDragOver={handleGridDragOver}
      onDragLeave={() => setFileDragActive(false)}
      onDrop={handleGridDrop}
    >
      <div className="pe-grid" onClick={handleGridClick}>
        {pages.map((page, index) => (
          <PDFEditThumb
            key={page.id}
            page={page}
            index={index}
            source={page.sourceId ? sources.get(page.sourceId) : null}
            selected={selectedSet.has(page.id)}
            size={effectiveThumb}
            stamps={stamps}
            total={pages.length}
            dropSide={dropMark && dropMark.index === index ? dropMark.side : null}
            scrollRoot={scrollRoot}
            onSelect={handleSelect}
            onRotate={rotateOne}
            onCrop={openCropFor}
            onDelete={deleteOne}
            onFullscreen={openViewFor}
            onDragStart={handleDragStart}
            onDragOver={handleThumbDragOver}
            onDrop={handleThumbDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
      {fileDragActive && <div className="pe-dropzone">Drop PDFs or images to add pages</div>}
    </div>
  )

  const modal = (
    <div className="pe-overlay">
      <div className={`pe-modal ${editing ? 'editing' : ''}`} role="dialog" aria-label="Edit PDF">
        <header className="pe-header">
          <div className="pe-title">
            <span className="pe-title-icon">
              <TuneIcon sx={{ fontSize: 20 }} />
            </span>
            <div className="pe-title-text">
              <strong>Edit PDF</strong>
              <span>
                {file.name}
                {ready ? ` · ${pages.length} page${pages.length === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          </div>
          <div className="pe-header-actions">
            {initialResult && (
              <button type="button" className="pe-btn" onClick={startOver} disabled={!ready || working}>
                <ReplayIcon sx={{ fontSize: 16 }} /> Start over
              </button>
            )}
            <button
              type="button"
              className="pe-icon-btn"
              onClick={() => dispatch({ type: 'undo' })}
              disabled={!history.past.length || working}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon sx={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              className="pe-icon-btn"
              onClick={() => dispatch({ type: 'redo' })}
              disabled={!history.future.length || working}
              aria-label="Redo"
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon sx={{ fontSize: 18 }} />
            </button>
            <span className="pe-header-sep" />
            <button type="button" className="pe-icon-btn" onClick={requestClose} disabled={working} aria-label="Close" title="Close">
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </header>

        {loadState.status === 'loading' && (
          <div className="pe-state">
            <span className="pe-spinner" />
            <p>Opening PDF…</p>
          </div>
        )}

        {loadState.status === 'error' && (
          <div className="pe-state">
            <p>{loadState.message}</p>
            <div className="pe-state-actions">
              {onUseCompression && (
                <button type="button" className="pe-btn primary" onClick={onUseCompression}>
                  Use compression only
                </button>
              )}
              <button type="button" className="pe-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}

        {ready && (
          <>
            <div className="pe-body">
              <div className="pe-main">
                <PDFEditToolbar
                  hidden={covered}
                  working={working}
                  pageCount={pages.length}
                  selectedCount={activeSelected.length}
                  canRemove={canRemove}
                  thumbSize={effectiveThumb}
                  thumbMin={THUMB_MIN}
                  thumbMax={thumbMax}
                  fileInputRef={fileInputRef}
                  onThumbSize={setThumbSize}
                  onFilesChosen={addFiles}
                  onBlank={insertBlank}
                  onRotate={rotateTargets}
                  onCrop={openCrop}
                  onAnnotate={openAnnotate}
                  onStraighten={straighten}
                  onFindBlank={scanBlank}
                  onSelectAll={() => setSelected(pages.map((page) => page.id))}
                  onClearSelection={() => setSelected([])}
                  onDuplicate={duplicateSelected}
                  onMove={moveSelected}
                  onKeep={keepSelected}
                  onDelete={deleteSelected}
                />

                <div className={covered ? 'pe-hidden' : 'pe-grid-wrap'}>{renderGrid()}</div>

                {viewPage && !editing && (
                  <PDFPageViewer
                    key={viewPage.id}
                    page={viewPage}
                    source={viewPage.sourceId ? sources.get(viewPage.sourceId) : null}
                    index={viewIndex}
                    total={pages.length}
                    stamps={stamps}
                    canDelete={pages.length > 1 && !working}
                    onNavigate={navigateView}
                    onClose={() => setViewPageId(null)}
                    onRotate={rotateOne}
                    onCrop={openCropFor}
                    onAnnotate={openAnnotateFor}
                    onDelete={deleteFromViewer}
                  />
                )}

                {annotatePage && (
                  <PDFAnnotateEditor
                    key={annotatePage.id}
                    page={annotatePage}
                    source={annotatePage.sourceId ? sources.get(annotatePage.sourceId) : null}
                    index={annotateIndex}
                    total={pages.length}
                    stamps={stamps}
                    onChange={changeAnnotations}
                    onNavigate={navigateAnnotate}
                    onClose={() => setAnnotatePageId(null)}
                    onCancel={cancelAnnotate}
                  />
                )}

                {cropPage && (
                  <PDFCropEditor
                    key={cropPage.id}
                    page={cropPage}
                    source={cropPage.sourceId ? sources.get(cropPage.sourceId) : null}
                    index={cropIndex}
                    total={pages.length}
                    selectedCount={activeSelected.length}
                    selectedIncludesPage={selectedSet.has(cropPage.id)}
                    onApply={applyCrop}
                    onNavigate={navigateCrop}
                    onClose={() => setCropPageId(null)}
                  />
                )}

                {(busyLabel || notice) && (
                  <div className="pe-floaters">
                    {busyLabel && (
                      <div className="pe-toast busy" role="status">
                        <span className="pe-spinner small" />
                        {busyLabel}
                      </div>
                    )}
                    {notice && (
                      <div className="pe-toast" role="status">
                        {notice}
                        <button type="button" className="pe-toast-close" onClick={() => setNotice('')} aria-label="Dismiss">
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <PDFEditSidebar
                open={sideOpen}
                tab={sideTab}
                onTab={setSideTab}
                onClose={() => setSideOpen(false)}
                filterProps={{
                  page: firstTarget,
                  source: firstTarget && firstTarget.sourceId ? sources.get(firstTarget.sourceId) : null,
                  active: activeFilter,
                  disabled: working,
                  onSelect: applyFilter,
                }}
                hasFilteredPages={hasFilteredPages}
                presetKey={presetKey}
                presetOptions={COMPRESSION_OPTIONS}
                onPreset={setPresetKey}
                stamps={stamps}
                onNumbers={updateNumbers}
                onWatermark={updateWatermark}
                originalText={formatBytes(file.size)}
                resultText={resultText}
                building={building}
                progress={progress}
                checked={builtCurrent}
                resultLarger={resultLarger}
                resultTooBig={resultTooBig}
                limitText={formatBytes(MAX_FILE_BYTES)}
                buildError={buildError}
                working={working}
                canApply={canApply}
                onCheck={build}
                onApply={handleApply}
                onCancel={requestClose}
                onUseCompression={onUseCompression}
              />
            </div>

            <div className="pe-bottom-bar">
              <button type="button" className="pe-btn" onClick={() => setSideOpen(true)}>
                Options
              </button>
              <button type="button" className="pe-btn primary" onClick={handleApply} disabled={!canApply}>
                {building ? 'Building…' : 'Apply changes'}
              </button>
            </div>
            {sideOpen && <div className="pe-backdrop" onClick={() => setSideOpen(false)} />}
          </>
        )}

        {confirmDiscard && (
          <div className="pe-confirm">
            <div className="pe-confirm-card">
              <strong>Discard changes?</strong>
              <p>Edits to this PDF will be lost.</p>
              <div className="pe-confirm-actions">
                <button type="button" className="pe-btn" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </button>
                <button type="button" className="pe-btn danger" onClick={onClose}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default PDFEditModal
