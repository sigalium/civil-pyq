import './css/ResourceList.css'

const ResourceList = ({ title, items, onItemClick }) => {
  return (
    <div className="resource-list">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={index} className="resource-item">
              <span>{item.name || item}</span>
              <button onClick={() => onItemClick(item)}>View</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-resources">No resources available</p>
      )}
    </div>
  )
}

export default ResourceList