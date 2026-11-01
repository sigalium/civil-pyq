import { parseBlocks } from '../utils/announcementMarkdown'
import './css/AnnouncementBody.css'

const linkProps = (href) => (href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })

const renderInline = (nodes, prefix) =>
  nodes.map((node, index) => {
    const key = `${prefix}-${index}`
    switch (node.type) {
      case 'text':
        return node.value
      case 'code':
        return <code key={key}>{node.value}</code>
      case 'bold':
        return <strong key={key}>{renderInline(node.children, key)}</strong>
      case 'italic':
        return <em key={key}>{renderInline(node.children, key)}</em>
      case 'underline':
        return <u key={key}>{renderInline(node.children, key)}</u>
      case 'link':
        return node.href ? (
          <a key={key} href={node.href} {...linkProps(node.href)}>
            {renderInline(node.children, key)}
          </a>
        ) : (
          renderInline(node.children, key)
        )
      case 'button':
        return node.href ? (
          <a key={key} className="announcement-btn" href={node.href} {...linkProps(node.href)}>
            {node.label}
          </a>
        ) : (
          node.label
        )
      default:
        return null
    }
  })

const renderList = (list, key) => {
  const Tag = list.ordered ? 'ol' : 'ul'
  return (
    <Tag key={key}>
      {list.items.map((item, index) => (
        <li key={`${key}-${index}`}>
          {renderInline(item.content, `${key}-${index}`)}
          {item.children.map((child, childIndex) => renderList(child, `${key}-${index}-${childIndex}`))}
        </li>
      ))}
    </Tag>
  )
}

const AnnouncementBody = ({ source }) => {
  const blocks = parseBlocks(source)
  return (
    <div className="announcement-body">
      {blocks.map((block, index) => {
        if (block.type === 'list') return renderList(block, `b${index}`)
        return (
          <p key={`b${index}`}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `b${index}-${lineIndex}`)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export default AnnouncementBody
