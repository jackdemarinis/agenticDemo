import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function ResultsPage({ runId, authToken, onBack }) {
  const [runData, setRunData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDraft, setSelectedDraft] = useState(null)

  useEffect(() => {
    if (!runId) return

    const fetchRunData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/run/${runId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        const data = await response.json()
        setRunData(data)
        setIsLoading(false)

        // Poll if still processing
        if (data.status === 'processing' || data.status === 'queued') {
          setTimeout(fetchRunData, 2000)
        }
      } catch (error) {
        console.error('Error fetching run data:', error)
        setIsLoading(false)
      }
    }

    fetchRunData()
  }, [runId, authToken])

  const getStatusColor = (status) => {
    switch (status) {
      case 'drafted':
        return 'text-green-600 bg-green-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'researched':
        return 'text-blue-600 bg-blue-50'
      case 'queued':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'drafted':
        return '✓'
      case 'failed':
        return '✗'
      case 'researched':
        return '⋯'
      case 'queued':
        return '○'
      default:
        return '○'
    }
  }

  const handleOpenGmail = () => {
    window.open('https://mail.google.com/mail/u/0/#drafts', '_blank')
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading campaign results...</p>
      </div>
    )
  }

  if (!runData) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">No campaign data found</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Campaign Builder
        </button>
      </div>
    )
  }

  const draftedCount = runData.recipients.filter(r => r.status === 'drafted').length
  const failedCount = runData.recipients.filter(r => r.status === 'failed').length
  const totalCount = runData.recipients.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Campaign Results</h2>
            <p className="text-sm text-gray-500 mt-1">
              Status: {runData.status.charAt(0).toUpperCase() + runData.status.slice(1)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleOpenGmail}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
            >
              Open Gmail Drafts
            </button>
            <button
              onClick={onBack}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
            >
              New Campaign
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Total Recipients</p>
            <p className="text-2xl font-bold text-blue-900">{totalCount}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Drafts Created</p>
            <p className="text-2xl font-bold text-green-900">{draftedCount}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-600 font-medium">Failed</p>
            <p className="text-2xl font-bold text-red-900">{failedCount}</p>
          </div>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Campaign Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Audience</p>
            <p className="font-medium text-gray-900">{runData.audience_type.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-500">Tone</p>
            <p className="font-medium text-gray-900 capitalize">{runData.tone}</p>
          </div>
          <div>
            <p className="text-gray-500">Personalization</p>
            <p className="font-medium text-gray-900 capitalize">{runData.personalization_level}</p>
          </div>
          <div>
            <p className="text-gray-500">User</p>
            <p className="font-medium text-gray-900">{runData.user_email}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-gray-500 text-sm mb-2">Pitch</p>
          <p className="text-gray-900">{runData.pitch}</p>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Draft Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runData.recipients.map((recipient) => (
                <tr key={recipient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {recipient.first_name} {recipient.last_name}
                      </div>
                      <div className="text-sm text-gray-500">{recipient.email}</div>
                      {recipient.company && (
                        <div className="text-xs text-gray-400">{recipient.company}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                      {recipient.inferred_outreach_mode?.toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(recipient.status)}`}>
                      {getStatusIcon(recipient.status)} {recipient.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {recipient.subject || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {recipient.status === 'drafted' && (
                      <button
                        onClick={() => setSelectedDraft(recipient)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Preview
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draft Preview Modal */}
      {selectedDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Draft Preview</h3>
              <button
                onClick={() => setSelectedDraft(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">To:</p>
                  <p className="text-gray-900">{selectedDraft.email}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Subject:</p>
                  <p className="text-gray-900 font-medium">{selectedDraft.subject}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Body:</p>
                  <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-900">
                    {selectedDraft.body}
                  </div>
                </div>

                {selectedDraft.rationale && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Personalization Rationale:</p>
                    <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
                      {selectedDraft.rationale}
                    </div>
                  </div>
                )}

                {selectedDraft.research_confidence && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Research Confidence:</p>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      selectedDraft.research_confidence === 'high' ? 'bg-green-100 text-green-800' :
                      selectedDraft.research_confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedDraft.research_confidence}
                    </span>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-500">Draft ID:</p>
                  <p className="text-xs text-gray-600 font-mono">{selectedDraft.draft_id}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedDraft(null)}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsPage
