import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// PUBLIC API - Pobieranie danych dla stron Astro
// =============================================================================
// Endpoint: GET /api/public/pages
// Headers: x-api-key: sk_xxxxx
// Query: ?slug=about (opcjonalnie)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Pobierz API key z headera
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }
    
    // Znajdź tenant po API key
    const tenant = await prisma.tenant.findUnique({
      where: { apiKey },
      select: {
        id: true,
        domain: true,
        name: true,
        settings: true,
        isActive: true,
      },
    });
    
    if (!tenant || !tenant.isActive) {
      return NextResponse.json(
        { error: 'Invalid API key or tenant inactive' },
        { status: 401 }
      );
    }
    
    // Pobierz parametry
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const template = searchParams.get('template');
    const status = searchParams.get('status') || 'PUBLISHED';
    
    // Buduj query
    const where: any = {
      tenantId: tenant.id,
      status: status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    };
    
    if (slug) {
      where.slug = slug;
    }
    
    if (template) {
      where.template = template;
    }
    
    // Pobierz strony
    const pages = await prisma.page.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        content: true,
        seo: true,
        template: true,
        order: true,
        publishedAt: true,
        updatedAt: true,
        parent: {
          select: {
            slug: true,
            title: true,
          },
        },
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
      orderBy: [
        { order: 'asc' },
        { title: 'asc' },
      ],
    });
    
    // Jeśli szukano konkretnej strony i nie znaleziono
    if (slug && pages.length === 0) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }
    
    // Zwróć dane
    return NextResponse.json({
      tenant: {
        name: tenant.name,
        domain: tenant.domain,
        settings: tenant.settings,
      },
      pages: slug ? pages[0] : pages,
    });
    
  } catch (error) {
    console.error('Public API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cache revalidation hint
export const revalidate = 60; // Revalidate every 60 seconds
