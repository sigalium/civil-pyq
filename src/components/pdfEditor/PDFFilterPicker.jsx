import { useEffect, useRef } from 'react'
import { FILTERS } from '../../utils/pdfEditor/filters'
import { renderDisplayCanvas } from '../../utils/pdfEditor/sources'

const PREVIEW_WIDTH = 150

const PDFFilterPicker = ({ page, source, active, disabled, onSelect }) => {
  const canvasRefs = useRef({})
  const pageId = page ? page.id : null
  const kind = page ? page.kind : null
  const sourceIndex = page ? page.sourceIndex : 0
  const baseRotation = page ? page.baseRotation : 0
  const baseW = page ? page.baseW : 0
  const baseH = page ? page.baseH : 0
  const rotation = page ? page.rotation : 0
  const skew = page ? page.skew : 0

  useEffect(() => {
    if (!pageId) return undefined
    let cancelled = false
    const descriptor = { kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter: 'original', annotations: [], skew }
    const run = async () => {
      for (const item of FILTERS) {
        if (cancelled) return
        try {
          const rendered = await renderDisplayCanvas(source, descriptor, { width: PREVIEW_WIDTH, filter: item.key, withAnnotations: false })
          const target = canvasRefs.current[item.key]
          if (cancelled || !target) {
            rendered.width = 0
            if (cancelled) return
            continue
          }
          target.width = rendered.width
          target.height = rendered.height
          target.getContext('2d').drawImage(rendered, 0, 0)
          rendered.width = 0
        } catch {
          return
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [pageId, source, kind, sourceIndex, baseRotation, baseW, baseH, rotation, skew])

  return (
    <div className="pe-filters">
      {FILTERS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`pe-filter ${active === item.key ? 'active' : ''}`}
          onClick={() => onSelect(item.key)}
          disabled={disabled}
        >
          <span className="pe-filter-preview">
            <canvas
              ref={(node) => {
                canvasRefs.current[item.key] = node
              }}
            />
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default PDFFilterPicker
