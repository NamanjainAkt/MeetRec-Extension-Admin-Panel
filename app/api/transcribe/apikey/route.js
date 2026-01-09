import { NextResponse } from 'next/server';

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
        console.log('[API] API Key request received');

        // DEBUG: Temporarily disable auth
        // const session = await getServerSession(authOptions);
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const apiKey = process.env.ASSEMBLYAI_API_KEY;

        if (!apiKey) {
            console.error('[API] ASSEMBLYAI_API_KEY not found in environment');
            throw new Error('API key not configured');
        }

        console.log('[API] Returning API key (first 10 chars):', apiKey.substring(0, 10) + '...');

        return NextResponse.json({ apiKey }, {
            headers: {
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true',
            }
        });
    } catch (error) {
        console.error('[API] Failed to return API key:', error);
        return NextResponse.json({ error: 'Failed to get API key: ' + error.message }, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true',
            }
        });
    }
}
