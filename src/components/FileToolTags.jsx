const FileToolTags = ({ meta }) => {
  if (!meta || (!meta.edited && !meta.compressed)) return null
  return (
    <>
      {meta.edited && <span className="file-tool-tag">Edited</span>}
      {meta.compressed && <span className="file-tool-tag">Compressed</span>}
    </>
  )
}

export default FileToolTags
