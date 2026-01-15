import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireTenant } from '@/lib/auth';
import { triggerDeploy } from '@/lib/deploy';
import { z } from 'zod';

// =============================================================================
// POST /api/deploy - Triggeruj deploy strony
// =============================================================================

const deploySchema = z.object({
  tenantId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { tenantId } = deploySchema.parse(body);
    
    // Sprawdź uprawnienia
    try {
      await requireTenant(tenantId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Triggeruj deploy
    const result = await triggerDeploy(tenantId, session.user.id);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      deploymentId: result.deploymentId,
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    console.error('Deploy error:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd serwera' },
      { status: 500 }
    );
  }
}
