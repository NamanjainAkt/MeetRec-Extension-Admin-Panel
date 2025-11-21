import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTranscript } from '@/lib/assemblyai';
import { generateSummary } from '@/lib/ai-summary';

export async function POST(request) {
    try {
        const { recordingId } = await request.json();

        const recording = await prisma.recording.findUnique({
            where: { id: recordingId }
        });

        if (!recording) {
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        // If already completed, return
        if (recording.transcriptionStatus === 'completed') {
            return NextResponse.json({
                status: 'completed',
                transcription: recording.transcription,
                summary: recording.summary
            });
        }

        // We need the transcript ID. 
        // PROBLEM: We didn't save the transcript ID in the database in the previous step.
        // We only fired the request. 
        // We need to fix the start process to save the transcript ID, OR we need to look it up.
        // AssemblyAI doesn't easily let us look up by URL unless we store the ID.

        // RETROACTIVE FIX: 
        // Since we can't easily get the ID for *existing* processing items if we didn't save it,
        // we might have to re-submit if we don't have an ID, or just fail for those.
        // But for *new* items, we should save the ID.

        // Let's check if we can find a way.
        // If we can't, we'll just say "Processing" until the webhook hits (which it won't on localhost).

        // PLAN B: Re-transcribe if requested and status is 'processing' but no ID? 
        // Or just update the schema to store `transcriptId`.

        // Let's update the schema to store `transcriptId`.

        // If we have a transcript ID, check AssemblyAI
        if (recording.transcriptId) {
            const transcript = await getTranscript(recording.transcriptId);

            if (transcript.status === 'completed') {
                // Generate summary (optional - if it fails, just skip it)
                let summary = '';
                try {
                    summary = await generateSummary(transcript.text);
                } catch (error) {
                    console.error('[API] Summary generation failed, skipping:', error.message);
                    summary = 'Summary generation failed. Please check your OpenRouter API key in .env file.';
                }

                // Update DB
                await prisma.recording.update({
                    where: { id: recordingId },
                    data: {
                        transcription: transcript.text,
                        summary: summary,
                        transcriptionStatus: 'completed'
                    }
                });

                return NextResponse.json({
                    status: 'completed',
                    transcription: transcript.text,
                    summary: summary
                });
            } else if (transcript.status === 'error') {
                await prisma.recording.update({
                    where: { id: recordingId },
                    data: { transcriptionStatus: 'failed' }
                });
                return NextResponse.json({ status: 'failed', error: transcript.error });
            }

            return NextResponse.json({ status: transcript.status });
        }

        return NextResponse.json({ status: recording.transcriptionStatus });

    } catch (error) {
        console.error('Status check failed:', error);
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }
}
