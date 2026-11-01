import { useState } from 'react'
import CompressIcon from '@mui/icons-material/Compress'
import TuneIcon from '@mui/icons-material/Tune'
import { editorSupported } from '../utils/pdfEditor/capability'

export function usePdfToolMeta() {
  const [editor] = useState(editorSupported)
  return editor
    ? { editor, label: 'Edit PDF', busyLabel: 'Editing…', Icon: TuneIcon }
    : { editor, label: 'Compress PDF', busyLabel: 'Compressing…', Icon: CompressIcon }
}
