import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { transcribeAudio } from '@/lib/assemblyai';

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { recordingId } = await request.json();

        const recording = await prisma.recording.findUnique({
            where: { id: recordingId }
        });

        if (!recording) {
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        // Start transcription
        const transcript = await transcribeAudio(recording.url);

        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                transcriptionStatus: 'processing',
                transcriptId: transcript.id
            }
        });

        return NextResponse.json({ success: true, transcriptId: transcript.id });
    } catch (error) {
        console.error('Transcription request failed:', error);
        return NextResponse.json({ error: 'Failed to start transcription' }, { status: 500 });
    }
}
