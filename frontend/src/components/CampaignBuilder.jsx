import { useState } from 'react'

const API_BASE = 'http://localhost:8000'

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

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/google/login`)
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

  const handleGenerateDrafts = async () => {
    setError(null)
    setIsLoading(true)

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

      // Start generation
      const generateResponse = await fetch(`${API_BASE}/api/run/${runData.run_id}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (!generateResponse.ok) throw new Error('Failed to generate drafts')

      onRunCreated(runData.run_id)
    } catch (error) {
      setError(error.message)
    } finally {
      setIsLoading(false)
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

      {/* Recipients Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recipients</h2>
          <div className="flex gap-2">
            <label className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 cursor-pointer">
              Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleAddRecipient}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Add Recipient
            </button>
          </div>
        </div>

        {csvPreview && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              CSV loaded: {csvPreview.valid_rows} valid recipients
              {csvPreview.invalid_rows.length > 0 && ` (${csvPreview.invalid_rows.length} invalid rows skipped)`}
            </p>
          </div>
        )}

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
    </div>
  )
}

export default CampaignBuilder
