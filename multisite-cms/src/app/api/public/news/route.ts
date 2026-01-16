import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { apiKey },
      select: { id: true, domain: true, name: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      return NextResponse.json(
        { error: "Invalid API key or tenant inactive" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where: Record<string, unknown> = {
      tenantId: tenant.id,
      template: "news",
      status: "PUBLISHED",
    };

    if (slug) {
      where.slug = slug;
    }

    const news = await prisma.page.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: slug ? 1 : limit,
    });

    if (slug && news.length === 0) {
      return NextResponse.json({ error: "News not found" }, { status: 404 });
    }

    const formattedNews = news.map((item) => {
      let content: { html?: string; image?: string } = {};

      try {
        let parsed = item.content;

        // Parsuj dopóki jest stringiem (obsługa podwójnego kodowania)
        while (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }

        content = parsed as { html?: string; image?: string };
      } catch {
        content = { html: "", image: undefined };
      }

      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        excerpt: item.description || "",
        image: content.image || null,
        content: content.html || "",
        author: item.author?.name || "Redakcja",
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
      };
    });

    return NextResponse.json({
      tenant: { name: tenant.name, domain: tenant.domain },
      news: slug ? formattedNews[0] : formattedNews,
      total: formattedNews.length,
    });
  } catch (error) {
    console.error("Public news API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const revalidate = 60;
