import { canEditPages, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createPageSchema = z.object({
  tenantId: z.string(),
  title: z.string().min(1, "Tytuł jest wymagany"),
  slug: z.string().min(1, "Slug jest wymagany"),
  description: z.string().optional(),
  content: z.any(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  template: z.string().default("default"),
  parentId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createPageSchema.parse(body);

    if (!canEditPages(session, data.tenantId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.page.findFirst({
      where: {
        tenantId: data.tenantId,
        slug: data.slug,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Strona o takim URL już istnieje" },
        { status: 400 }
      );
    }

    // SQLite - content jako JSON string
    const page = await prisma.page.create({
      data: {
        tenantId: data.tenantId,
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        content: JSON.stringify(data.content || {}), // <-- STRING
        seo: "{}",
        status: data.status,
        template: data.template,
        parentId: data.parentId || null,
        authorId: session.user.id,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Create page error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}
