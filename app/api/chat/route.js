import { minimaxClient, MINIMAX_MODEL } from '@/lib/minimax';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function OPTIONS(request) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
        },
    });
}

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        // Note: If session is missing due to cross-origin cookie issues, we might need to relax auth or use a token.
        // For now, we assume cookies work with credentials: include.
        if (!session) {
            // For dev/demo purposes, if session fails, we might want to allow it or return 401.
            // Let's return 401 but with CORS headers so the frontend sees the error.
            return NextResponse.json({ error: 'Unauthorized' }, {
                status: 401,
                headers: {
                    'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                    'Access-Control-Allow-Credentials': 'true',
                }
            });
        }

        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
        }

        // Create a stream
        const stream = await minimaxClient.messages.create({
            model: MINIMAX_MODEL,
            max_tokens: 1024,
            messages: messages,
            stream: true,
        });

        // Return a streaming response
        const encoder = new TextEncoder();
        const customStream = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    if (chunk.type === 'content_block_delta') {
                        controller.enqueue(encoder.encode(chunk.delta.text));
                    }
                }
                controller.close();
            },
        });

        return new Response(customStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true',
            },
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true',
            }
        });
    }
}
