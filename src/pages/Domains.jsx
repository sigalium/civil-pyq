import { Link } from 'react-router-dom'
import { OpenInNew, Domain } from '@mui/icons-material'
import './styles/Domains.css'

const Domains = () => {
  const domains = [
    {
      name: 'CivilPYQ (Primary)',
      url: 'https://civilpyq.netlify.app',

      description: 'Main domain with all features'
    },
    {
      name: 'CivilPYQ Backup',
      url: 'https://civilpyqgcu.netlify.app',
      description: 'Alternative domain if primary is down'
    },
    // {
    //   name: 'CivilPYQ Mirror',
    //   url: 'https://civilpyq-mirror.netlify.app',
    //   description: 'Additional backup mirror'
    // }
  ]

  return (
    <div className="domains fade-in">
      <div className="domains-container">
        <h1>Use our other domains if you're facing issues</h1>
        <p className="subtitle">
          We provide multiple access points to ensure you can always reach your study resources
        </p>

        <div className="domains-grid">
          {domains.map((domain, index) => (
            <div key={index} className="domain-card">
              <div className="domain-icon">
                <Domain fontSize="large" />
              </div>
              <h3>{domain.name}</h3>
              <p>{domain.description}</p>
              <a
                href={domain.url}
                target="_blank"
                rel="noopener noreferrer"
                className="domain-link"
              >
                Visit Domain <OpenInNew fontSize="small" />
              </a>
            </div>
          ))}
        </div>

        <div className="domains-info">
          <h2>Why multiple domains?</h2>
          <p>
            We maintain multiple domains to ensure uninterrupted access to your study materials.
            If one domain is experiencing technical difficulties or is temporarily unavailable,
            you can use any of our alternative domains.
          </p>
          <Link to="/" className="home-link">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Domains