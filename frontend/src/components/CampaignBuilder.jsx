import { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function CampaignBuilder({ authStatus, authToken, onRunCreated, onAuthStatusChange }) {
  const [pitch, setPitch] = useState('')
  const [signOff, setSignOff] = useState('')
  const [audienceType, setAudienceType] = useState('mixed')
  const [tone, setTone] = useState('professional')
  const [personalizationLevel, setPersonalizationLevel] = useState('medium')
  const [recipients, setRecipients] = useState([{ email: '', first_name: '', last_name: '', company: '', role: '' }])
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [currentRunId, setCurrentRunId] = useState(null)
  const progressInterval = useRef(null)

  // Input mode: 'manual', 'csv', or 'ai'
  const [inputMode, setInputMode] = useState('manual')

  // AI Input state
  const [aiSeedInput, setAiSeedInput] = useState('')
  const [aiLocation, setAiLocation] = useState('')
  const [aiIndustryHint, setAiIndustryHint] = useState('')
  const [aiMaxResults, setAiMaxResults] = useState(10)
  const [aiDiscoveryId, setAiDiscoveryId] = useState(null)
  const [aiDiscoveryProgress, setAiDiscoveryProgress] = useState(null)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const discoveryInterval = useRef(null)

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/google/login`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (!response.ok) {
        throw new Error('Failed to initiate Google login')
      }
      const data = await response.json()
      window.location.href = data.auth_url
    } catch (error) {
      setError('Failed to initiate Google login')
    }
  }

  const handleAddRecipient = () => {
    setRecipients([...recipients, { email: '', first_name: '', last_name: '', company: '', role: '' }])
  }

  const handleRemoveRecipient = (index) => {
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  const handleRecipientChange = (index, field, value) => {
    const updated = [...recipients]
    updated[index][field] = value
    setRecipients(updated)
  }

  const handleCsvUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setCsvFile(file)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE}/api/recipients/parse-csv`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      })

      if (!response.ok) throw new Error('CSV parsing failed')

      const data = await response.json()
      setCsvPreview(data)

      // Auto-populate recipients from CSV
      if (data.preview && data.preview.length > 0) {
        setRecipients(data.preview.map(row => ({
          email: row.email || '',
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          company: row.company || '',
          role: row.role || '',
          location: row.location || '',
          linkedin_url: row.linkedin_url || '',
          notes: row.notes || ''
        })))
      }
    } catch (error) {
      setError(`CSV upload failed: ${error.message}`)
    }
  }

  // AI Discovery functions
  const handleStartDiscovery = async () => {
    if (!aiSeedInput || !aiLocation) {
      setError('Please enter a search term and location')
      return
    }

    setError(null)
    setIsDiscovering(true)
    setAiDiscoveryProgress(null)

    try {
      const response = await fetch(`${API_BASE}/api/leads/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          seed_input: aiSeedInput,
          location: aiLocation,
          industry_hint: aiIndustryHint || null,
          max_results: aiMaxResults
        })
      })

      if (!response.ok) throw new Error('Failed to start discovery')

      const data = await response.json()
      setAiDiscoveryId(data.discovery_id)

      // Start polling for progress
      discoveryInterval.current = setInterval(() => pollDiscoveryProgress(data.discovery_id), 2000)

    } catch (error) {
      setError(`Discovery failed: ${error.message}`)
      setIsDiscovering(false)
    }
  }

  const pollDiscoveryProgress = async (discoveryId) => {
    try {
      const response = await fetch(`${API_BASE}/api/leads/discover/${discoveryId}/progress`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setAiDiscoveryProgress(data)

        // Stop polling when complete or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (discoveryInterval.current) {
            clearInterval(discoveryInterval.current)
            discoveryInterval.current = null
          }

          if (data.status === 'completed' && data.leads && data.leads.length > 0) {
            // Convert leads to recipients format
            setRecipients(data.leads.map(lead => ({
              email: lead.email || '',
              first_name: lead.first_name || '',
              last_name: '',
              company: lead.company || '',
              role: '',
              location: lead.location || '',
              company_website_url: lead.company_website_url || '',
              notes: lead.notes || ''
            })))
          }

          setIsDiscovering(false)
        }
      }
    } catch (error) {
      console.error('Error polling discovery progress:', error)
    }
  }

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
      if (discoveryInterval.current) {
        clearInterval(discoveryInterval.current)
      }
    }
  }, [])

  const pollProgress = async (runId) => {
    try {
      const response = await fetch(`${API_BASE}/api/run/${runId}/progress`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        setProgress(data)

        // Stop polling when complete
        if (data.run_status === 'completed' || data.run_status === 'failed') {
          if (progressInterval.current) {
            clearInterval(progressInterval.current)
            progressInterval.current = null
          }
        }
      }
    } catch (error) {
      console.error('Error polling progress:', error)
    }
  }

  const handleGenerateDrafts = async () => {
    setError(null)
    setIsLoading(true)
    setProgress(null)

    try {
      // Create run
      const runResponse = await fetch(`${API_BASE}/api/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          pitch,
          sign_off: signOff,
          audience_type: audienceType,
          tone,
          personalization_level: personalizationLevel,
          recipients: recipients.filter(r => r.email)
        })
      })

      if (!runResponse.ok) {
        const errorData = await runResponse.json()
        throw new Error(errorData.detail || 'Failed to create run')
      }

      const runData = await runResponse.json()
      setCurrentRunId(runData.run_id)

      // Initialize progress
      const totalRecipients = recipients.filter(r => r.email).length
      setProgress({
        total: totalRecipients,
        completed: 0,
        processing: 0,
        queued: totalRecipients,
        drafted: 0,
        failed: 0,
        progress_percent: 0,
        run_status: 'processing'
      })

      // Start polling for progress
      progressInterval.current = setInterval(() => pollProgress(runData.run_id), 1000)

      // Start generation (this will return when complete)
      const generateResponse = await fetch(`${API_BASE}/api/run/${runData.run_id}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      // Stop polling
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }

      if (!generateResponse.ok) throw new Error('Failed to generate drafts')

      onRunCreated(runData.run_id)
    } catch (error) {
      setError(error.message)
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }

  const isFormValid = authStatus.connected && pitch.trim() && recipients.some(r => r.email)

  return (
    <div className="space-y-8">
      {/* Gmail Connection Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gmail Connection</h2>
        {!authStatus.connected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Connect your Gmail account to create drafts. You will maintain full control - drafts are never sent automatically.
            </p>
            <button
              onClick={handleGoogleLogin}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Connect Gmail Account
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900">Connected to Gmail</span>
          </div>
        )}
      </div>

      {/* Campaign Configuration */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Campaign Configuration</h2>

        {/* Pitch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Pitch
          </label>
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="What do you want to communicate? (e.g., I'm offering a free SEO audit for e-commerce businesses...)"
          />
        </div>

        {/* Sign Off */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Sign-Off
          </label>
          <textarea
            value={signOff}
            onChange={(e) => setSignOff(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="How you want to sign off (e.g., Best Regards,&#10;Jack DeMarinis)"
          />
          <p className="mt-1 text-xs text-gray-500">
            This will be added at the end of each email. You can include multiple lines.
          </p>
        </div>

        {/* Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audience Type
            </label>
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="b2b">B2B</option>
              <option value="b2c">B2C</option>
              <option value="mixed">Mixed (Auto-detect)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personalization Level
            </label>
            <select
              value={personalizationLevel}
              onChange={(e) => setPersonalizationLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Low (Generic)</option>
              <option value="medium">Medium (Role/Company)</option>
              <option value="high">High (Public Research)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recipients Section with Tabs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setInputMode('manual')}
              className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors ${
                inputMode === 'manual'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Manual Input
              </div>
            </button>
            <button
              onClick={() => setInputMode('csv')}
              className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors ${
                inputMode === 'csv'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV Upload
              </div>
            </button>
            <button
              onClick={() => setInputMode('ai')}
              className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors ${
                inputMode === 'ai'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Input
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">NEW</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Manual Input Tab */}
          {inputMode === 'manual' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-medium text-gray-900">Add Recipients Manually</h3>
                <button
                  onClick={handleAddRecipient}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
                >
                  + Add Recipient
                </button>
              </div>
              <div className="space-y-4">
                {recipients.map((recipient, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="email"
                          placeholder="Email (required)"
                          value={recipient.email}
                          onChange={(e) => handleRecipientChange(index, 'email', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="First Name"
                          value={recipient.first_name}
                          onChange={(e) => handleRecipientChange(index, 'first_name', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={recipient.last_name}
                          onChange={(e) => handleRecipientChange(index, 'last_name', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Company"
                          value={recipient.company}
                          onChange={(e) => handleRecipientChange(index, 'company', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Role/Title"
                          value={recipient.role}
                          onChange={(e) => handleRecipientChange(index, 'role', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      {recipients.length > 1 && (
                        <button
                          onClick={() => handleRemoveRecipient(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CSV Upload Tab */}
          {inputMode === 'csv' && (
            <div>
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Drop your CSV file here or <span className="text-blue-600 hover:text-blue-700">browse</span>
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    CSV should have columns: email, first_name, last_name, company, role
                  </p>
                </div>
              </div>

              {csvPreview && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-medium text-green-900">
                      CSV loaded: {csvPreview.valid_rows} valid recipients
                      {csvPreview.invalid_rows.length > 0 && ` (${csvPreview.invalid_rows.length} invalid rows skipped)`}
                    </p>
                  </div>
                </div>
              )}

              {recipients.length > 0 && recipients[0].email && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Preview ({recipients.length} recipients)</h4>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {recipients.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-sm text-gray-900">{r.email}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{r.first_name} {r.last_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{r.company}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recipients.length > 5 && (
                      <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                        ...and {recipients.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Input Tab */}
          {inputMode === 'ai' && (
            <div>
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-purple-900">AI-Powered Lead Discovery</h3>
                    <p className="mt-1 text-sm text-purple-700">
                      Enter a keyword or website URL, and our AI will discover potential leads by searching the web and extracting business information from public sources.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Term or Website URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={aiSeedInput}
                    onChange={(e) => setAiSeedInput(e.target.value)}
                    placeholder="e.g., 'coffee shop' or 'https://example.com'"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isDiscovering}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter a business type, industry keyword, or a sample website URL
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={aiLocation}
                    onChange={(e) => setAiLocation(e.target.value)}
                    placeholder="e.g., 'Austin, TX' or 'San Francisco Bay Area'"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isDiscovering}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Industry Hint (Optional)
                    </label>
                    <input
                      type="text"
                      value={aiIndustryHint}
                      onChange={(e) => setAiIndustryHint(e.target.value)}
                      placeholder="e.g., 'food and beverage', 'tech startup'"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isDiscovering}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Results
                    </label>
                    <select
                      value={aiMaxResults}
                      onChange={(e) => setAiMaxResults(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isDiscovering}
                    >
                      <option value={5}>5 leads</option>
                      <option value={10}>10 leads</option>
                      <option value={15}>15 leads</option>
                      <option value={20}>20 leads</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleStartDiscovery}
                  disabled={isDiscovering || !aiSeedInput || !aiLocation}
                  className={`w-full py-3 px-6 font-medium rounded-lg transition-all ${
                    isDiscovering || !aiSeedInput || !aiLocation
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isDiscovering ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Discovering Leads...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Discover Leads
                    </span>
                  )}
                </button>
              </div>

              {/* Discovery Progress */}
              {isDiscovering && aiDiscoveryProgress && (
                <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-900">
                      {aiDiscoveryProgress.message}
                    </span>
                    <span className="text-sm text-purple-700">
                      {aiDiscoveryProgress.current} / {aiDiscoveryProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(aiDiscoveryProgress.current / aiDiscoveryProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Discovery Results */}
              {!isDiscovering && aiDiscoveryProgress?.status === 'completed' && recipients.length > 0 && recipients[0].email && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h4 className="text-sm font-semibold text-gray-900">
                      Found {recipients.filter(r => r.email).length} leads with email addresses
                    </h4>
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {recipients.filter(r => r.email).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{r.company || 'Unknown'}</div>
                              {r.first_name && (
                                <div className="text-xs text-gray-500">{r.first_name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{r.email}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{r.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No results message */}
              {!isDiscovering && aiDiscoveryProgress?.status === 'completed' && (!recipients.length || !recipients[0].email) && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-yellow-800">
                      No leads with email addresses found. Try a different search term or location.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerateDrafts}
          disabled={!isFormValid || isLoading}
          className={`px-8 py-3 font-medium rounded-lg ${
            isFormValid && !isLoading
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Generating Drafts...' : 'Generate Drafts'}
        </button>
      </div>

      {/* Progress Modal */}
      {isLoading && progress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              {/* Spinning loader */}
              <div className="relative w-20 h-20 mx-auto mb-4">
                <svg className="animate-spin w-20 h-20" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75 text-blue-600"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-700">{progress.progress_percent}%</span>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating Drafts
              </h3>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress.progress_percent}%` }}
                />
              </div>

              {/* Progress stats */}
              <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Total</p>
                  <p className="font-semibold text-gray-900">{progress.total}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-green-600">Completed</p>
                  <p className="font-semibold text-green-900">{progress.drafted}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-blue-600">Processing</p>
                  <p className="font-semibold text-blue-900">{progress.processing + progress.queued}</p>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                {progress.completed} of {progress.total} recipients processed
              </p>

              {progress.failed > 0 && (
                <p className="text-sm text-red-500 mt-1">
                  {progress.failed} failed
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignBuilder
