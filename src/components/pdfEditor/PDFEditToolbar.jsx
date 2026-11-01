import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import CropIcon from '@mui/icons-material/Crop'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PostAddIcon from '@mui/icons-material/PostAdd'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeselectIcon from '@mui/icons-material/Deselect'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import BorderColorIcon from '@mui/icons-material/BorderColor'
import FindInPageIcon from '@mui/icons-material/FindInPage'
import StraightenIcon from '@mui/icons-material/Straighten'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'

const ToolButton = (props) => (
  <button
    type="button"
    className={`pe-tool ${props.danger ? 'danger' : ''}`}
    onClick={props.onClick}
    disabled={props.disabled}
    aria-label={props.label}
    title={props.label}
  >
    <props.icon sx={{ fontSize: 20 }} />
    <span>{props.label}</span>
  </button>
)

const ChipButton = (props) => (
  <button
    type="button"
    className={`pe-chip ${props.danger ? 'danger' : ''}`}
    onClick={props.onClick}
    disabled={props.disabled}
    aria-label={props.label}
    title={props.label}
  >
    <props.icon sx={{ fontSize: 16 }} />
    <span>{props.label}</span>
  </button>
)

const PDFEditToolbar = ({
  hidden,
  working,
  pageCount,
  selectedCount,
  canRemove,
  thumbSize,
  thumbMin,
  thumbMax,
  fileInputRef,
  onThumbSize,
  onFilesChosen,
  onBlank,
  onRotate,
  onCrop,
  onAnnotate,
  onStraighten,
  onFindBlank,
  onSelectAll,
  onClearSelection,
  onDuplicate,
  onMove,
  onKeep,
  onDelete,
}) => {
  const hasSelection = selectedCount > 0

  return (
    <div className={`pe-toolbar ${hidden ? 'pe-hidden' : ''}`}>
      <div className="pe-tools">
        <div className="pe-tool-group">
          <ToolButton icon={PostAddIcon} label="Add files" onClick={() => fileInputRef.current?.click()} disabled={working} />
          <ToolButton icon={NoteAddIcon} label="Blank page" onClick={onBlank} disabled={working} />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            hidden
            onChange={(event) => {
              const chosen = event.target.files
              onFilesChosen(chosen)
              event.target.value = ''
            }}
          />
        </div>
        <div className="pe-tool-group">
          <ToolButton icon={RotateLeftIcon} label="Rotate left" onClick={() => onRotate(-90)} disabled={working} />
          <ToolButton icon={RotateRightIcon} label="Rotate right" onClick={() => onRotate(90)} disabled={working} />
          <ToolButton icon={CropIcon} label="Crop" onClick={onCrop} disabled={working} />
          <ToolButton icon={BorderColorIcon} label="Annotate" onClick={onAnnotate} disabled={working} />
        </div>
        <div className="pe-tool-group">
          <ToolButton icon={StraightenIcon} label="Straighten" onClick={onStraighten} disabled={working} />
          <ToolButton icon={FindInPageIcon} label="Find blanks" onClick={onFindBlank} disabled={working} />
        </div>
        <label className="pe-zoom">
          <ZoomOutIcon sx={{ fontSize: 16 }} />
          <input
            type="range"
            min={thumbMin}
            max={thumbMax}
            step="10"
            value={thumbSize}
            style={{ '--fill': `${Math.round(((thumbSize - thumbMin) / Math.max(1, thumbMax - thumbMin)) * 100)}%` }}
            onChange={(event) => onThumbSize(Number(event.target.value))}
            aria-label="Thumbnail size"
          />
          <ZoomInIcon sx={{ fontSize: 16 }} />
        </label>
      </div>

      <div className="pe-selbar">
        <div className="pe-selinfo">
          <strong>{hasSelection ? `${selectedCount} of ${pageCount} selected` : `${pageCount} page${pageCount === 1 ? '' : 's'}`}</strong>
          {!hasSelection && <span>Rotate, crop and annotate apply to all pages.</span>}
        </div>
        <div className="pe-selactions">
          <ChipButton icon={SelectAllIcon} label="Select all" onClick={onSelectAll} disabled={working || selectedCount === pageCount} />
          {hasSelection && <ChipButton icon={DeselectIcon} label="Clear" onClick={onClearSelection} disabled={working} />}
          {hasSelection && (
            <>
              <span className="pe-sel-sep" />
              <ChipButton icon={ContentCopyIcon} label="Duplicate" onClick={onDuplicate} disabled={working} />
              <ChipButton icon={ArrowBackIcon} label="Earlier" onClick={() => onMove(-1)} disabled={working} />
              <ChipButton icon={ArrowForwardIcon} label="Later" onClick={() => onMove(1)} disabled={working} />
              <ChipButton icon={PlaylistAddCheckIcon} label="Keep only" onClick={onKeep} disabled={!canRemove || working} />
              <ChipButton icon={DeleteIcon} label="Delete" onClick={onDelete} disabled={!canRemove || working} danger />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PDFEditToolbar
