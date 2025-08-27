import { useEffect } from 'react'
import './styles/Contribute.css'
import contributors from '../data/contributors'

const Contribute = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const openGoogleForm = () => {
    window.open('https://forms.gle/nASVybF4tGw635jU9', '_blank')
  }

  // Filter contributors by type
  const studentContributors = contributors.filter(contributor => contributor.type === 'student');
  const facultyContributors = contributors.filter(contributor => contributor.type === 'faculty');

  return (
    <div className="contribute fade-in">
      <div className="contribute-container">
        <section className="contribute-hero">
          <h1>Want to be a contributor?</h1>
          <p className="subtitle">
            Love helping others? Join us in making a difference!
            Contribute to our growing collection and support students like you.
          </p>
          <p className="perks">Bonus: A special spot for you on our contributors page! 💖🌟</p>
          <button className="contribute-btn" onClick={openGoogleForm}>
            Click here to contribute
          </button>
        </section>

        <section className="contributors-section">
          <h2>Our Student Contributors</h2>
          <div className="contributors-grid">
            {studentContributors.map((contributor, index) => (
              <div key={index} className="contributor-card">
                <div className="contributor-pfp">
                  {contributor.profilePic ? (
                    <img
                      src={contributor.profilePic}
                      alt={contributor.name}
                      className="pfp-img"
                    />
                  ) : (
                    <span className="pfp-placeholder">{contributor.name.charAt(0)}</span>
                  )}
                </div>
                <h3>{contributor.name}</h3>
                <p>Batch of {contributor.batchYear}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="contributors-section">
          <h2>Our Faculty Contributors</h2>
          <div className="contributors-grid">
            {facultyContributors.map((faculty, index) => (
              <div key={index} className="contributor-card">
                <div className="contributor-pfp">
                  {faculty.profilePic ? (
                    <img
                      src={faculty.profilePic}
                      alt={faculty.name}
                      className="pfp-img"
                    />
                  ) : (
                    <span className="pfp-placeholder">{faculty.name.charAt(0)}</span>
                  )}
                </div>
                <h3>{faculty.name}</h3>
                <p>{faculty.department}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Contribute