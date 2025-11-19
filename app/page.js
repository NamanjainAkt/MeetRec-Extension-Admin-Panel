import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">
          🎥 Meeting Recorder
        </h1>
        <p className="text-gray-600 mb-8">
          Record, store, and manage your meeting recordings with ease.
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Sign In to Get Started
        </Link>
      </div>
    </main>
  )
}
