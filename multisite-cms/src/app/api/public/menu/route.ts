import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// PUBLIC API - Menu nawigacji
// =============================================================================
// Endpoint: GET /api/public/menu
// Headers: x-api-key: sk_xxxxx
// =============================================================================

interface MenuItem {
  slug: string;
  title: string;
  order: number;
  children?: MenuItem[];
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }
    
    const tenant = await prisma.tenant.findUnique({
      where: { apiKey },
      select: { id: true, isActive: true },
    });
    
    if (!tenant || !tenant.isActive) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    // Pobierz strony głównego poziomu (bez parenta)
    const pages = await prisma.page.findMany({
      where: {
        tenantId: tenant.id,
        status: 'PUBLISHED',
        parentId: null,
      },
      select: {
        slug: true,
        title: true,
        order: true,
        children: {
          where: { status: 'PUBLISHED' },
          select: {
            slug: true,
            title: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
    
    // Przekształć na strukturę menu
    const menu: MenuItem[] = pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      order: page.order,
      children: page.children.length > 0 ? page.children : undefined,
    }));
    
    return NextResponse.json({ menu });
    
  } catch (error) {
    console.error('Menu API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const revalidate = 60;
