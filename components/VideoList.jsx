'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import VideoPlayer from './VideoPlayer'

export default function VideoList({ recordings }) {
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [isDeleting, setIsDeleting] = useState(null)
  const router = useRouter()

  const handleDelete = async (e, id) => {
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this recording?')) {
      return
    }

    setIsDeleting(id)
    try {
      const res = await fetch(`/api/recordings?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to delete recording')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete recording')
    } finally {
      setIsDeleting(null)
    }
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-500 mb-4">No recordings yet</p>
        <p className="text-sm text-gray-400">
          Install the Chrome extension and start recording!
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer group relative"
            onClick={() => setSelectedVideo(recording)}
          >
            <div className="aspect-video bg-gray-200 flex items-center justify-center relative">
              <video
                src={recording.url}
                poster={recording.url.replace(/\.[^/.]+$/, ".jpg")}
                className="w-full h-full object-cover"
                preload="metadata"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white bg-opacity-80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-gray-900 ml-1">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1">
                  {recording.title || 'Untitled Recording'}
                </h3>
                <p className="text-xs text-gray-500">
                  {new Date(recording.createdAt).toLocaleString('en-US')}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, recording.id)}
                disabled={isDeleting === recording.id}
                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                title="Delete recording"
              >
                {isDeleting === recording.id ? (
                  <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedVideo && (
        <VideoPlayer
          recording={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  )
}
