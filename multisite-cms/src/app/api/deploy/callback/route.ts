import { NextRequest, NextResponse } from 'next/server';
import { handleBuildCallback } from '@/lib/deploy';

// =============================================================================
// POST /api/deploy/callback - Callback z CI/CD (GitHub Actions)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Weryfikuj webhook secret
    const webhookSecret = request.headers.get('X-Webhook-Secret');
    const expectedSecret = process.env.WEBHOOK_SECRET;
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { deploymentId, status, buildLog, duration } = body;
    
    if (!deploymentId) {
      return NextResponse.json(
        { error: 'deploymentId is required' },
        { status: 400 }
      );
    }
    
    if (!['SUCCESS', 'FAILED'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be SUCCESS or FAILED' },
        { status: 400 }
      );
    }
    
    await handleBuildCallback(
      deploymentId,
      status as 'SUCCESS' | 'FAILED',
      buildLog,
      duration
    );
    
    console.log(`Deployment ${deploymentId} callback received: ${status}`);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
