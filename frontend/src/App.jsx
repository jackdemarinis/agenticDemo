import { useState, useEffect } from 'react'
import CampaignBuilder from './components/CampaignBuilder'
import ResultsPage from './components/ResultsPage'

const API_BASE = 'http://localhost:8000'

function App() {
  const [currentView, setCurrentView] = useState('builder') // 'builder' or 'results'
  const [currentRunId, setCurrentRunId] = useState(null)
  const [authStatus, setAuthStatus] = useState({ connected: false, email: null })

  useEffect(() => {
    checkAuthStatus()

    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      const email = params.get('email')
      setAuthStatus({ connected: true, email })
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/status`)
      const data = await response.json()
      setAuthStatus(data)
    } catch (error) {
      console.error('Error checking auth status:', error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/google/disconnect`, { method: 'POST' })
      setAuthStatus({ connected: false, email: null })
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  const handleRunCreated = (runId) => {
    setCurrentRunId(runId)
    setCurrentView('results')
  }

  const handleBackToBuilder = () => {
    setCurrentView('builder')
    setCurrentRunId(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">DraftSmith</h1>
              <p className="text-sm text-gray-500">AI-Powered Email Draft Generator</p>
            </div>
            {authStatus.connected && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Connected as:</p>
                  <p className="text-sm text-gray-500">{authStatus.email}</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'builder' ? (
          <CampaignBuilder
            authStatus={authStatus}
            onRunCreated={handleRunCreated}
            onAuthStatusChange={checkAuthStatus}
          />
        ) : (
          <ResultsPage
            runId={currentRunId}
            onBack={handleBackToBuilder}
          />
        )}
      </main>

      <footer className="mt-16 border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            DraftSmith - Demo of Agentic Email Systems | Emails are created as drafts only - you maintain full control
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
