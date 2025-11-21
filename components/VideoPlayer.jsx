'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

export default function VideoPlayer({ recording, onClose }) {
  const [activeTab, setActiveTab] = useState('video')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [currentRecording, setCurrentRecording] = useState(recording)

  const handleTranscribe = async () => {
    setIsTranscribing(true)
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: recording.id }),
      })

      if (res.ok) {
        // Optimistically update status
        setCurrentRecording(prev => ({ ...prev, transcriptionStatus: 'processing' }))
        alert('Transcription started! It will appear here once complete.')
      } else {
        alert('Failed to start transcription')
      }
    } catch (error) {
      console.error('Transcription error:', error)
      alert('Failed to start transcription')
    } finally {
      setIsTranscribing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 className="text-lg font-semibold">
            {currentRecording.title || 'Meeting Recording'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex border-b bg-gray-50 shrink-0">
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'video' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('video')}
          >
            Video
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'transcript' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('transcript')}
          >
            Transcript
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'summary' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'video' && (
            <div>
              <video
                src={currentRecording.url.replace(/\.webm$/, '.mp4').replace(/\.mkv$/, '.mp4')}
                controls
                autoPlay
                className="w-full max-h-[60vh] bg-black"
              />
              <div className="mt-4 text-sm text-gray-500">
                <p>
                  Recorded on: {new Date(currentRecording.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-4">
              {currentRecording.transcription ? (
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {currentRecording.transcription}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    {currentRecording.transcriptionStatus === 'processing'
                      ? 'Transcription is processing... Check back later.'
                      : 'No transcript available.'}
                  </p>
                  {currentRecording.transcriptionStatus !== 'processing' && currentRecording.transcriptionStatus !== 'completed' && (
                    <button
                      onClick={handleTranscribe}
                      disabled={isTranscribing}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isTranscribing ? 'Starting...' : 'Generate Transcript'}
                    </button>
                  )}

                  {currentRecording.transcriptionStatus === 'processing' && (
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/transcribe/status', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ recordingId: recording.id }),
                        });
                        const data = await res.json();
                        if (data.status === 'completed') {
                          setCurrentRecording(prev => ({
                            ...prev,
                            transcriptionStatus: 'completed',
                            transcription: data.transcription,
                            summary: data.summary
                          }));
                        } else {
                          alert('Status: ' + data.status);
                        }
                      }}
                      className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Refresh Status
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-4">
              {currentRecording.summary ? (
                <div className="prose max-w-none text-gray-700">
                  <ReactMarkdown>{currentRecording.summary}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    {currentRecording.transcriptionStatus === 'processing'
                      ? 'Summary will be generated after transcription.'
                      : 'No summary available.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
