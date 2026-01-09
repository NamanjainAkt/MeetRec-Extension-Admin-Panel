import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createTemporaryToken } from '@/lib/assemblyai';

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
        console.log('[API] Token request received');

        // DEBUG: Temporarily disable auth to isolate issue
        // const session = await getServerSession(authOptions);
        // if (!session) {
        //     console.log('[API] Unauthorized: No session');
        //     return NextResponse.json({ error: 'Unauthorized' }, { 
        //       status: 401,
        //       headers: {
        //         'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
        //         'Access-Control-Allow-Credentials': 'true',
        //       }
        //     });
        // }

        console.log('[API] Creating temporary token...');
        const token = await createTemporaryToken({
            expires_in: 3600,
            speech_model: 'best'
        }); // 1 hour token, using Universal Streaming
        console.log('[API] Token created successfully');

        return NextResponse.json({ token }, {
            headers: {
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true',
            }
        });
    } catch (error) {
        console.error('[API] Failed to create temporary token:', error);
        return NextResponse.json({ error: 'Failed to create token: ' + error.message }, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true',
            }
        });
    }
}
