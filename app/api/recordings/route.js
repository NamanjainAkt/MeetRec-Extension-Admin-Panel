import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/recordings
 * Save recording metadata (video already uploaded to Cloudinary)
 */
export async function POST(request) {
  try {
    console.log('[API] POST /api/recordings - Saving recording metadata');

    // Get session (allow testing without auth for now)
    const session = await getServerSession(authOptions).catch(() => null);

    // For now, use test user ID - in production, require authentication
    const userId = session?.user?.id || 'test-user-id';

    console.log('[API] User ID:', userId);

    const body = await request.json();
    const { title, url, publicId, duration, size, platform } = body;

    console.log('[API] Request data:', {
      title,
      url,
      publicId,
      duration,
      size,
      platform
    });

    // Validate required fields
    if (!url || !publicId) {
      console.error('[API] Missing required fields:', { url, publicId });
      return NextResponse.json(
        { error: 'Missing required fields: url, publicId' },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!url.startsWith('https://res.cloudinary.com/')) {
      console.error('[API] Invalid Cloudinary URL:', url);
      return NextResponse.json(
        { error: 'Invalid Cloudinary URL' },
        { status: 400 }
      );
    }

    // Save to database
    console.log('[API] Saving to database...');
    const recording = await prisma.recording.create({
      data: {
        userId: userId,
        title: title || 'Untitled Recording',
        url: url,
        publicId: publicId,
        duration: duration || 0,
        size: size || 0,
        platform: platform || 'unknown',
        status: 'completed'
      },
    });

    console.log('[API] Recording metadata saved successfully:', recording.id);

    return NextResponse.json({
      success: true,
      recording: {
        id: recording.id,
        title: recording.title,
        url: recording.url,
        duration: recording.duration,
        platform: recording.platform,
        createdAt: recording.createdAt
      }
    });

  } catch (error) {
    console.error('[API] Save metadata error:', error);
    return NextResponse.json(
      { error: `Failed to save recording metadata: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recordings
 * Get all recordings for current user
 */
export async function GET(request) {
  try {
    console.log('[API] GET /api/recordings - Fetching recordings');

    const session = await getServerSession(authOptions);

    if (!session) {
      console.log('[API] No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] User ID from session:', session.user.id);

    const recordings = await prisma.recording.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log(`[API] Found ${recordings.length} recordings`);

    return NextResponse.json({
      success: true,
      recordings: recordings.map(r => ({
        id: r.id,
        title: r.title,
        url: r.url,
        publicId: r.publicId,
        duration: r.duration,
        size: r.size,
        platform: r.platform,
        status: r.status,
        createdAt: r.createdAt
      }))
    });

  } catch (error) {
    console.error('[API] Get recordings error:', error);
    return NextResponse.json(
      { error: `Failed to fetch recordings: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recordings
 * Delete a recording
 */
export async function DELETE(request) {
  try {
    console.log('[API] DELETE /api/recordings - Deleting recording');

    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get('id');

    if (!recordingId) {
      return NextResponse.json(
        { error: 'Recording ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Deleting recording:', recordingId);

    // Verify recording belongs to user
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId }
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    if (recording.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete from database
    await prisma.recording.delete({
      where: { id: recordingId }
    });

    console.log('[API] Recording deleted successfully');

    // TODO: Optionally delete from Cloudinary
    // This would require Cloudinary API credentials and additional logic

    return NextResponse.json({
      success: true,
      message: 'Recording deleted successfully'
    });

  } catch (error) {
    console.error('[API] Delete recording error:', error);
    return NextResponse.json(
      { error: `Failed to delete recording: ${error.message}` },
      { status: 500 }
    );
  }
}
