import { useEffect } from 'react'
import './Contribute.css'

const contributors = [
  { name: 'John Doe', batchYear: '2077', profilePic: '/Contributor/male01.png' },
  { name: 'Jane Doe', batchYear: '2077', profilePic: '/Contributor/female02.png' }, 
  { name: 'Add Yours Here', batchYear: '2025' },
  // profilePic: '/images/john.jpg', saved in public folder
]

const Contribute = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const openGoogleForm = () => {
    window.open('https://forms.gle/nASVybF4tGw635jU9', '_blank')
  }

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
          <h2>Our Valued Contributors</h2>
          <div className="contributors-grid">
            {contributors.map((contributor, index) => (
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
      </div>
    </div>
  )
}

export default Contribute