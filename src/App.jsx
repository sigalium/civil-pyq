import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Resources from './pages/Resources'
import Contribute from './pages/Contribute'
import About from './pages/About'
import ScrollToTop from './components/ScrollToTop'
import './App.css'
import StarryBackground from './components/StarryBackground'
import NotFound from './pages/NotFound'
import Domains from './pages/Domains'

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <Router>
      <ScrollToTop />
      <div className="app">
        <StarryBackground />
        <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
        <div className={`content ${isMenuOpen ? 'blur' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/resources/:semester" element={<Resources />} />
            <Route path="/resources/:semester/:subject" element={<Resources />} />
            <Route path="/contribute" element={<Contribute />} />
            <Route path="/about" element={<About />} />
            <Route path="/domains" element={<Domains />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  )
}

export default App