import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Select from '../Select'
import { STAMP_FORMATS, STAMP_POSITIONS, WATERMARK_OPACITIES, stampsActive } from '../../utils/pdfEditor/stamps'
import PDFFilterPicker from './PDFFilterPicker'

const TABS = [
  { key: 'enhance', label: 'Enhance' },
  { key: 'stamps', label: 'Stamps' },
  { key: 'export', label: 'Compress' },
]

const ToggleRow = ({ label, checked, onChange }) => (
  <div className="pe-toggle-row">
    <span>{label}</span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`pe-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="pe-toggle-knob" />
    </button>
  </div>
)

const PDFEditSidebar = ({
  open,
  tab,
  onTab,
  onClose,
  filterProps,
  hasFilteredPages,
  presetKey,
  presetOptions,
  onPreset,
  stamps,
  onNumbers,
  onWatermark,
  originalText,
  resultText,
  building,
  progress,
  checked,
  resultLarger,
  resultTooBig,
  limitText,
  buildError,
  working,
  canApply,
  onCheck,
  onApply,
  onCancel,
  onUseCompression,
}) => {
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <aside className={`pe-side ${open ? 'open' : ''}`}>
      <span className="pe-sheet-handle" aria-hidden="true" />
      <div className="pe-side-head">
        <strong>Output options</strong>
        <button type="button" className="pe-icon-btn" onClick={onClose} aria-label="Close options">
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="pe-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`pe-tab ${tab === item.key ? 'active' : ''}`}
            onClick={() => onTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="pe-side-body">
        {tab === 'enhance' && (
          <div className="pe-section">
            <span className="pe-section-title">Scan filter</span>
            <PDFFilterPicker {...filterProps} />
            <p className="pe-note">Applies to selected pages, or all if none is selected.</p>
            {hasFilteredPages && <p className="pe-note">Filtered pages are converted to images.</p>}
          </div>
        )}

        {tab === 'stamps' && (
          <>
            <div className="pe-section">
              <span className="pe-section-title">Page numbers</span>
              <ToggleRow label="Add page numbers" checked={stamps.numbers.enabled} onChange={(value) => onNumbers({ enabled: value })} />
              {stamps.numbers.enabled && (
                <div className="pe-field-row">
                  <Select value={stamps.numbers.position} options={STAMP_POSITIONS} onChange={(value) => onNumbers({ position: value })} />
                  <Select value={stamps.numbers.format} options={STAMP_FORMATS} onChange={(value) => onNumbers({ format: value })} />
                </div>
              )}
            </div>
            <div className="pe-section">
              <span className="pe-section-title">Watermark</span>
              <ToggleRow label="Add watermark" checked={stamps.watermark.enabled} onChange={(value) => onWatermark({ enabled: value })} />
              {stamps.watermark.enabled && (
                <>
                  <input
                    className="pe-input"
                    type="text"
                    value={stamps.watermark.text}
                    maxLength={40}
                    placeholder="Watermark text"
                    onChange={(event) => onWatermark({ text: event.target.value })}
                  />
                  <div className="pe-segment">
                    {WATERMARK_OPACITIES.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`pe-segment-btn ${stamps.watermark.opacity === item.key ? 'active' : ''}`}
                        onClick={() => onWatermark({ opacity: item.key })}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {stampsActive(stamps) && <p className="pe-note">Stamps are added when the file is built.</p>}
          </>
        )}

        {tab === 'export' && (
          <>
            <div className="pe-section">
              <span className="pe-section-title">Compression</span>
              <div className="pe-presets">
                {presetOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`pe-preset ${presetKey === option.key ? 'active' : ''}`}
                    onClick={() => onPreset(option.key)}
                    disabled={working}
                  >
                    {option.label}
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
              {presetKey !== 'none' && <p className="pe-note">Pages are converted to images.</p>}
            </div>

            <div className="pe-section">
              <span className="pe-section-title">Result size</span>
              <div className="pe-stats">
                <div className="pe-stat">
                  <span>Original</span>
                  <strong>{originalText}</strong>
                </div>
                <div className="pe-stat">
                  <span>Result</span>
                  <strong>{resultText}</strong>
                </div>
              </div>
              {building && (
                <div className="pe-progress" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
                  <span style={{ width: `${percent}%` }} />
                </div>
              )}
              {checked && !resultTooBig && !resultLarger && (
                <p className="pe-alert ok">
                  <CheckCircleIcon sx={{ fontSize: 16 }} /> Ready to apply.
                </p>
              )}
              {resultLarger && !resultTooBig && (
                <p className="pe-alert warn">
                  <WarningAmberIcon sx={{ fontSize: 16 }} /> Result is larger than the original.
                </p>
              )}
              {resultTooBig && (
                <p className="pe-alert warn">
                  <WarningAmberIcon sx={{ fontSize: 16 }} /> Result exceeds the {limitText} limit.
                </p>
              )}
              {buildError && (
                <p className="pe-alert warn">
                  <WarningAmberIcon sx={{ fontSize: 16 }} /> {buildError}
                </p>
              )}
              {buildError && onUseCompression && (
                <button type="button" className="pe-btn" onClick={onUseCompression}>
                  Use compression only
                </button>
              )}
              <button type="button" className="pe-btn" onClick={onCheck} disabled={working}>
                {building ? 'Building…' : 'Check size'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="pe-side-footer">
        <button type="button" className="pe-btn primary block" onClick={onApply} disabled={!canApply}>
          {building ? 'Building…' : 'Apply changes'}
        </button>
        <button type="button" className="pe-btn ghost block pe-cancel" onClick={onCancel} disabled={working}>
          Cancel
        </button>
      </div>
    </aside>
  )
}

export default PDFEditSidebar
