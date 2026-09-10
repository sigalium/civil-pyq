import { useEffect } from 'react'
import { CREATOR_LINKS } from '../data/appData'
import './styles/About.css'

const About = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="about fade-in">
      <div className="about-container">
        <section className="profile-section">
          <div className="profile-pic">
            <img
              src="/emoji_sunglasses.svg"
              alt="Profile"
              className="profile-image"
            />
          </div>
          <div className="profile-info">
            <h1>About Me</h1>
            <p className="bio">
              Hi, I'm Priyangkam Bhuyan, a civil engineering undergraduate from the batch of 2028 at Girijananda Chowdhury University.
              I'm the creator of CivilPYQ, a platform designed to make quality study materials and past year question papers 
              easily accessible to civil engineering students. My goal is to simplify exam preparation and support fellow 
              students with reliable resources, all in one convenient place.
            </p>
            <div className="social-links">
              <a href={CREATOR_LINKS.github} className="social-link" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-github"></i>
              </a>
              <a href={CREATOR_LINKS.linkedin} className="social-link" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-linkedin"></i>
              </a>
              <a href={CREATOR_LINKS.website} className="social-link" target="_blank" rel="noopener noreferrer">
                <i className="fas fa-globe"></i>
              </a>
              <a href={CREATOR_LINKS.instagram} className="social-link" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-instagram"></i>
              </a>
              <a href={`mailto:${CREATOR_LINKS.email}`} className="social-link">
                <i className="fas fa-envelope"></i>
              </a>
            </div>
          </div>
        </section>

        <section className="project-info">
          <h2>About CivilPYQ</h2>
          <p>
            CivilPYQ was created with the goal of making study resources more accessible to civil engineering students of 
            Girijananda Chowdhury University. We collect and organize past year question papers, lab manuals, and other useful 
            materials to help students prepare for their exams more effectively.
          </p>
          <p>
            {/* The platform is constantly growing thanks to contributions from students and faculty members who believe in
            the power of shared knowledge and collaborative learning. */}
            This platform needs your help. We're just getting started, and to truly grow, we need more contributors, students 
            and faculty, who believe in the power of shared knowledge and collaborative learning.
          </p>
        </section>
      </div>
    </div>
  )
}

export default About
