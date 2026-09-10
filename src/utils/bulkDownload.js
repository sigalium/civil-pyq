import JSZip from 'jszip'

function sanitizeFileName(name) {
  return (name || 'file').replace(/[\\/:*?"<>|]/g, '-')
}

function extensionFromPath(path) {
  const match = /\.[a-zA-Z0-9]+($|\?)/.exec(path || '')
  return match ? match[0].replace('?', '') : '.pdf'
}

export async function downloadSubjectZip(subjectName, files, onProgress) {
  const zip = new JSZip()
  const usedNames = new Set()
  let done = 0

  for (const file of files) {
    try {
      const response = await fetch(file.path)
      if (!response.ok) throw new Error('fetch failed')
      const blob = await response.blob()
      let fileName = `${sanitizeFileName(file.name)}${extensionFromPath(file.path)}`
      let attempt = 1
      while (usedNames.has(fileName)) {
        fileName = `${sanitizeFileName(file.name)} (${attempt})${extensionFromPath(file.path)}`
        attempt += 1
      }
      usedNames.add(fileName)
      zip.file(fileName, blob)
    } catch {
      // skip files that fail to fetch, rest of the zip still succeeds
    }
    done += 1
    if (onProgress) onProgress(done, files.length)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFileName(subjectName)}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
