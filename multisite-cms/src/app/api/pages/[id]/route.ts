import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEditPages } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

interface Params {
  params: Promise<{ id: string }>;
}

// =============================================================================
// PUT /api/pages/[id] - Aktualizuj stronę
// =============================================================================

const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.any().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  template: z.string().optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().optional(),
});

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Pobierz stronę
    const page = await prisma.page.findUnique({
      where: { id },
      select: { tenantId: true, status: true },
    });
    
    if (!page) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // Sprawdź uprawnienia
    if (!canEditPages(session, page.tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const data = updatePageSchema.parse(body);
    
    // Sprawdź unikalność slug jeśli zmieniony
    if (data.slug) {
      const existing = await prisma.page.findFirst({
        where: {
          tenantId: page.tenantId,
          slug: data.slug,
          id: { not: id },
        },
      });
      
      if (existing) {
        return NextResponse.json(
          { error: 'Strona o takim URL już istnieje' },
          { status: 400 }
        );
      }
    }
    
    // Przygotuj dane do aktualizacji
    const updateData: any = { ...data };
    
    // Ustaw publishedAt jeśli status zmienia się na PUBLISHED
    if (data.status === 'PUBLISHED' && page.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }
    
    // Aktualizuj stronę
    const updated = await prisma.page.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({ success: true, page: updated });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    console.error('Update page error:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd serwera' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/pages/[id] - Usuń stronę
// =============================================================================

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Pobierz stronę
    const page = await prisma.page.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    
    if (!page) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // Sprawdź uprawnienia
    if (!canEditPages(session, page.tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Usuń stronę
    await prisma.page.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Delete page error:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd serwera' },
      { status: 500 }
    );
  }
}
