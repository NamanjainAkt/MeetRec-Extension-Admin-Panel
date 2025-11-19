import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cloudinary } from '@/lib/cloudinary'

export async function POST(request) {
  try {
    // Temporarily allow uploads without auth for extension testing
    // In production, uncomment the auth check below
    const session = await getServerSession(authOptions).catch(() => null)

    if (!session) {
      console.log('[API] No session found, allowing upload for testing')
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('video')
    const title = formData.get('title') || 'Untitled Recording'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'meeting-recordings',
          format: 'webm',
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    const recording = await prisma.recording.create({
      data: {
        userId: session?.user?.id || 'test-user-id', // Use test user if no session
        title,
        url: result.secure_url,
        publicId: result.public_id,
      },
    })

    return NextResponse.json({
      success: true,
      recording,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
