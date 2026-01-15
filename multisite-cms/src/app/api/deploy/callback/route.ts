import { NextRequest, NextResponse } from 'next/server';
import { handleBuildCallback } from '@/lib/deploy';
import { z } from 'zod';

// =============================================================================
// DEPLOY CALLBACK API
// =============================================================================
// Endpoint: POST /api/deploy/callback
// Headers: x-webhook-secret: xxxxx
// Body: { deploymentId, status, buildLog?, duration? }
// =============================================================================

const callbackSchema = z.object({
  deploymentId: z.string(),
  status: z.enum(['SUCCESS', 'FAILED']),
  buildLog: z.string().optional(),
  duration: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Weryfikuj secret
    const secret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.BUILD_WEBHOOK_SECRET;
    
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { deploymentId, status, buildLog, duration } = callbackSchema.parse(body);
    
    await handleBuildCallback(deploymentId, status, buildLog, duration);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    console.error('Deploy callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
