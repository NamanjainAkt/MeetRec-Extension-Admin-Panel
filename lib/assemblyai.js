import { AssemblyAI } from 'assemblyai';

const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export async function transcribeAudio(audioUrl) {
    try {
        const transcript = await client.transcripts.transcribe({
            audio: audioUrl,
        });

        return transcript;
    } catch (error) {
        console.error('AssemblyAI Transcription Error:', error);
        throw error;
    }
}

export async function getTranscript(transcriptId) {
    try {
        const transcript = await client.transcripts.get(transcriptId);
        return transcript;
    } catch (error) {
        console.error('AssemblyAI Get Transcript Error:', error);
        throw error;
    }
}
