import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// PUBLIC API - Pobieranie aktualności dla stron Astro
// =============================================================================
// Endpoint: GET /api/public/news
// Headers: x-api-key: sk_xxxxx
// Query: ?slug=aktualnosc-1 (opcjonalnie, dla pojedynczej)
//        ?limit=10 (opcjonalnie, domyślnie 20)
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
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    // Buduj query - aktualności to strony z template="news"
    const where: Record<string, unknown> = {
      tenantId: tenant.id,
      template: 'news',
      status: 'PUBLISHED',
    };
    
    if (slug) {
      where.slug = slug;
    }
    
    // Pobierz aktualności
    const news = await prisma.page.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true, // używamy jako excerpt
        content: true,     // JSON z html i image
        seo: true,
        publishedAt: true,
        updatedAt: true,
        author: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: slug ? 1 : limit,
    });
    
    // Jeśli szukano konkretnej aktualności i nie znaleziono
    if (slug && news.length === 0) {
      return NextResponse.json(
        { error: 'News not found' },
        { status: 404 }
      );
    }
    
    // Parsuj content JSON dla każdej aktualności
    const formattedNews = news.map((item) => {
      let content: { html?: string; image?: string; excerpt?: string } = {};
      try {
        content = typeof item.content === 'string' 
          ? JSON.parse(item.content) 
          : item.content as { html?: string; image?: string; excerpt?: string };
      } catch {
        content = { html: '' };
      }
      
      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        excerpt: item.description || content.excerpt || '',
        image: content.image || null,
        content: content.html || '',
        author: item.author?.name || 'Redakcja',
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
      };
    });
    
    // Zwróć dane
    return NextResponse.json({
      tenant: {
        name: tenant.name,
        domain: tenant.domain,
      },
      news: slug ? formattedNews[0] : formattedNews,
      total: slug ? 1 : formattedNews.length,
    });
    
  } catch (error) {
    console.error('Public news API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cache headers
export const revalidate = 60;
