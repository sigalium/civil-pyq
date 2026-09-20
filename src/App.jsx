import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Resources from './pages/Resources'
import CodesAndStandards from './pages/CodesAndStandards'
import Contribute from './pages/Contribute'
import About from './pages/About'
import './App.css'
import AnimatedBackground from './components/AnimatedBackground'
import NotFound from './pages/NotFound'
import Domains from './pages/Domains'
import BottomNavbar from './components/BottomNavbar';
import Settings from './pages/Settings'
import OfflineLibrary from './pages/OfflineLibrary'
import OfflineRedirect from './components/OfflineRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import { PDFWindowProvider } from './context/PDFWindowContext'
import PDFWindowManager from './components/PDFWindowManager'
import ResourcesQuickNav from './components/ResourcesQuickNav'
import PDFUrlSync from './components/PDFUrlSync'
import MaintenanceGate from './components/MaintenanceGate'
import OfflineDataBadge from './components/OfflineDataBadge'
import InstallPrompt from './components/InstallPrompt'
import NotificationStack from './components/NotificationStack'

const Dashboard = lazy(() => import('./pages/Dashboard'))

function DashboardFallback() {
  return (
    <div className="gate-screen">
      <div className="gate-card">
        <p>Loading...</p>
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [pathname])

  return null
}

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
            <MaintenanceGate>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/resources/codes-and-standards" element={<CodesAndStandards />} />
                <Route path="/resources/is-codes" element={<Navigate to="/resources/codes-and-standards" replace />} />
                <Route path="/resources/:semester" element={<Resources />} />
                <Route path="/resources/:semester/:subject" element={<Resources />} />
                <Route path="/contribute" element={<Contribute />} />
                <Route path="/about" element={<About />} />
                <Route path="/domains" element={<Domains />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/offline-library" element={<OfflineLibrary />} />
                <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<DashboardFallback />}><Dashboard /></Suspense></ProtectedRoute>} />
                <Route path="/dashboard/:tab" element={<ProtectedRoute><Suspense fallback={<DashboardFallback />}><Dashboard /></Suspense></ProtectedRoute>} />
                <Route path="/dashboard/:tab/:subpath" element={<ProtectedRoute><Suspense fallback={<DashboardFallback />}><Dashboard /></Suspense></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceGate>
          </div>
          <Footer />
          <PDFWindowManager />
          <ResourcesQuickNav />
          <PDFUrlSync />
          <OfflineDataBadge />
          <InstallPrompt />
          <NotificationStack />
        </div>
      </PDFWindowProvider>
    </Router>
  )
}

export default App