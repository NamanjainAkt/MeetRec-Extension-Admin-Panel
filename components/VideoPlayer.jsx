'use client'

export default function VideoPlayer({ recording, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">
            {recording.title || 'Meeting Recording'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <video
            src={recording.url.replace(/\.webm$/, '.mp4').replace(/\.mkv$/, '.mp4')}
            controls
            autoPlay
            className="w-full max-h-[70vh]"
          />
          <div className="mt-4 text-sm text-gray-500">
            <p>
              Recorded on: {new Date(recording.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
