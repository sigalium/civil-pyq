import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ResourcesDataProvider } from './context/ResourcesDataContext'
import { ContributorsDataProvider } from './context/ContributorsDataContext'
import { registerServiceWorker } from './utils/offlineStorage'
import './index.css'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ResourcesDataProvider>
          <ContributorsDataProvider>
            <App />
          </ContributorsDataProvider>
        </ResourcesDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
