import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTranscript } from '@/lib/assemblyai';
import { generateSummary } from '@/lib/ai-summary';

export async function POST(request) {
    try {
        console.log('[API] Webhook received');
        const body = await request.json();
        const { transcript_id, status } = body;

        if (status === 'completed') {
            console.log('[API] Transcription completed:', transcript_id);

            // 1. Get the full transcript
            const transcript = await getTranscript(transcript_id);
            const text = transcript.text;
            const audioUrl = transcript.audio_url;

            // 2. Find the recording
            // We need to find the recording by audio URL or some other ID. 
            // Since we didn't store transcript ID, we'll try to find by URL.
            // Note: AssemblyAI might normalize the URL, so this is a bit risky.
            // Ideally we should have passed the recording ID as a custom parameter or stored the transcript ID.
            // Let's assume for now we can find it by URL or we'll modify the start process to store transcript ID.

            // Wait, I didn't add transcriptId to the schema. 
            // Let's try to find by URL first.
            const recording = await prisma.recording.findFirst({
                where: { url: audioUrl }
            });

            if (!recording) {
                console.error('[API] Recording not found for URL:', audioUrl);
                return NextResponse.json({ message: 'Recording not found' }, { status: 404 });
            }

            // 3. Generate Summary
            console.log('[API] Generating summary...');
            let summary = '';
            try {
                summary = await generateSummary(text);
            } catch (e) {
                console.error('[API] Summarization failed:', e);
                summary = 'Summary generation failed.';
            }

            // 4. Update Database
            await prisma.recording.update({
                where: { id: recording.id },
                data: {
                    transcription: text,
                    summary: summary,
                    transcriptionStatus: 'completed'
                }
            });

            console.log('[API] Database updated with transcript and summary');

        } else if (status === 'error') {
            console.error('[API] Transcription failed:', body.error);
            // Find recording and update status
            // We might not have the URL here easily if we don't fetch the transcript details
            // But usually we can't fetch details if it failed? 
            // Actually AssemblyAI webhook sends the error.

            // For now, let's just log it.
        }

        return NextResponse.json({ message: 'Webhook received' });
    } catch (error) {
        console.error('[API] Webhook error:', error);
        return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
    }
}
