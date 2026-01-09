export async function generateSummary(transcriptText) {
    try {
        console.log('[OpenRouter] Generating summary...');

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://meet-rec-extension-admin-panel.vercel.app',
                'X-Title': 'MeetRec',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tngtech/deepseek-r1t2-chimera:free',
                messages: [
                    {
                        role: 'user',
                        content: `You are an expert meeting assistant. Summarize the following meeting transcript.
                        
Please provide:
1. A concise summary of the meeting (2-3 paragraphs).
2. Key takeaways or action items (bullet points).

Transcript:
${transcriptText}`
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const summary = data.choices[0].message.content;

        console.log('[OpenRouter] Summary generated successfully');
        return summary;
    } catch (error) {
        console.error('OpenRouter Summarization Error:', error);
        throw error;
    }
}
