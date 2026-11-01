const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/)/i
const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i
const LIST_LINE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/

export function sanitizeUrl(raw) {
  const url = (raw || '').trim()
  if (!url) return null
  if (SAFE_URL.test(url)) return url
  if (BARE_DOMAIN.test(url)) return `https://${url}`
  return null
}

const INLINE_PATTERNS = [
  { type: 'code', re: /`([^`]+)`/ },
  { type: 'button', re: /\[\[button:\s*([^|\]]+?)\s*\|\s*([^\]\s]+)\s*\]\]/ },
  { type: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { type: 'bold', re: /\*\*(.+?)\*\*/ },
  { type: 'underline', re: /\+\+(.+?)\+\+/ },
  { type: 'italic', re: /\*([^*\s](?:[^*]*[^*\s])?)\*/ },
]

export function parseInline(text) {
  const nodes = []
  let rest = text
  while (rest) {
    let best = null
    for (const pattern of INLINE_PATTERNS) {
      const match = pattern.re.exec(rest)
      if (match && (!best || match.index < best.match.index)) best = { pattern, match }
    }
    if (!best) {
      nodes.push({ type: 'text', value: rest })
      break
    }
    const { pattern, match } = best
    if (match.index > 0) nodes.push({ type: 'text', value: rest.slice(0, match.index) })
    if (pattern.type === 'code') nodes.push({ type: 'code', value: match[1] })
    else if (pattern.type === 'button') nodes.push({ type: 'button', label: match[1], href: sanitizeUrl(match[2]) })
    else if (pattern.type === 'link') nodes.push({ type: 'link', href: sanitizeUrl(match[2]), children: parseInline(match[1]) })
    else nodes.push({ type: pattern.type, children: parseInline(match[1]) })
    rest = rest.slice(match.index + match[0].length)
  }
  return nodes
}

export function parseBlocks(source) {
  const lines = (source || '').replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')
  const blocks = []
  let paragraph = []
  let root = null
  let stack = []

  const makeList = (ordered, indent) => ({ type: 'list', ordered, indent, items: [] })
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', lines: paragraph.map(parseInline) })
      paragraph = []
    }
  }
  const flushList = () => {
    if (root) {
      blocks.push(root)
      root = null
      stack = []
    }
  }
  const attachNested = (parentList, ordered, indent) => {
    const parentItem = parentList.items[parentList.items.length - 1]
    const nested = makeList(ordered, indent)
    parentItem.children.push(nested)
    stack.push(nested)
  }

  for (const line of lines) {
    const match = LIST_LINE.exec(line)
    if (match) {
      flushParagraph()
      const indent = match[1].length
      const ordered = /\d/.test(match[2])
      const item = { content: parseInline(match[3]), children: [] }
      if (!root) {
        root = makeList(ordered, indent)
        stack = [root]
      } else {
        while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop()
        const top = stack[stack.length - 1]
        if (indent > top.indent) {
          attachNested(top, ordered, indent)
        } else if (ordered !== top.ordered) {
          if (stack.length === 1) {
            flushList()
            root = makeList(ordered, indent)
            stack = [root]
          } else {
            stack.pop()
            attachNested(stack[stack.length - 1], ordered, indent)
          }
        }
      }
      stack[stack.length - 1].items.push(item)
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else if (root && /^\s{2,}/.test(line)) {
      const deepest = stack[stack.length - 1]
      const last = deepest.items[deepest.items.length - 1]
      last.content.push({ type: 'text', value: ' ' }, ...parseInline(line.trim()))
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
  return blocks
}

function inlineToText(nodes) {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.value
      if (node.type === 'button') return node.label
      return inlineToText(node.children || [])
    })
    .join('')
}

export function toPlainText(source) {
  const parts = []
  const walkList = (list) => {
    list.items.forEach((item) => {
      parts.push(inlineToText(item.content))
      item.children.forEach(walkList)
    })
  }
  parseBlocks(source).forEach((block) => {
    if (block.type === 'paragraph') parts.push(block.lines.map(inlineToText).join(' '))
    else walkList(block)
  })
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
