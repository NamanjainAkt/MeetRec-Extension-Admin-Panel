'use client'

import { useState } from 'react'
import VideoPlayer from './VideoPlayer'

export default function VideoList({ recordings }) {
  const [selectedVideo, setSelectedVideo] = useState(null)

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
            className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer"
            onClick={() => setSelectedVideo(recording)}
          >
            <div className="aspect-video bg-gray-200 flex items-center justify-center">
              <video
                src={recording.url}
                className="w-full h-full object-cover"
                preload="metadata"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-2">
                {recording.title || 'Untitled Recording'}
              </h3>
              <p className="text-sm text-gray-500">
                {new Date(recording.createdAt).toLocaleString()}
              </p>
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
