import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ResourcesDataProvider } from './context/ResourcesDataContext'
import { ContributorsDataProvider } from './context/ContributorsDataContext'
import { NotificationProvider } from './context/NotificationContext'
import { InboxProvider } from './context/InboxContext'
import { BookmarksProvider } from './context/BookmarksContext'
import { CleanupProvider } from './context/CleanupContext'
import { registerServiceWorker } from './utils/offlineStorage'
import './index.css'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ResourcesDataProvider>
            <ContributorsDataProvider>
              <NotificationProvider>
                <InboxProvider>
                  <BookmarksProvider>
                    <CleanupProvider>
                      <App />
                    </CleanupProvider>
                  </BookmarksProvider>
                </InboxProvider>
              </NotificationProvider>
            </ContributorsDataProvider>
          </ResourcesDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
