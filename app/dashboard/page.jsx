import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import VideoList from '@/components/VideoList'
import SignOutButton from '@/components/SignOutButton'

async function getRecordings(userId) {
  return await prisma.recording.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/api/auth/signin')
  }

  const recordings = await getRecordings(session.user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              🎥 Meeting Recorder
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {session.user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Your Recordings
          </h2>
          <p className="text-gray-600">
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
          </p>
        </div>

        <VideoList recordings={recordings} />
      </main>
    </div>
  )
}
