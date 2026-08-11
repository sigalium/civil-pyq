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
import AnimatedBackground from './components/AnimatedBackground'
import NotFound from './pages/NotFound'
import Domains from './pages/Domains'
import BottomNavbar from './components/BottomNavbar';
import Settings from './pages/Settings'
import OfflineLibrary from './pages/OfflineLibrary'
import OfflineRedirect from './components/OfflineRedirect'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import { PDFWindowProvider } from './context/PDFWindowContext'
import PDFWindowManager from './components/PDFWindowManager'

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <Router>
      <ScrollToTop />
      <OfflineRedirect />
      <PDFWindowProvider>
        <div className="app">
          <AnimatedBackground />
          <BottomNavbar />
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/offline-library" element={<OfflineLibrary />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/:tab" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Footer />
          <PDFWindowManager />
        </div>
      </PDFWindowProvider>
    </Router>
  )
}

export default App