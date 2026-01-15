import { getSession, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey, slugify } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// =============================================================================
// GET /api/tenants - Lista tenantów
// =============================================================================

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let tenants;

    if (isSuperAdmin(session)) {
      tenants = await prisma.tenant.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { pages: true, users: true },
          },
        },
      });
    } else if (session.user.tenantId) {
      tenants = await prisma.tenant.findMany({
        where: { id: session.user.tenantId },
        include: {
          _count: {
            select: { pages: true, users: true },
          },
        },
      });
    } else {
      tenants = [];
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error("Get tenants error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/tenants - Utwórz nowego tenanta
// =============================================================================

const createTenantSchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  slug: z.string().optional(),
  domain: z.string().min(1, "Domena jest wymagana"),
  domains: z.array(z.string()).default([]),
  settings: z
    .object({
      logo: z.string().optional(),
      primaryColor: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    console.log("Received body:", body);

    const data = createTenantSchema.parse(body);

    const slug = data.slug || slugify(data.name);

    // Sprawdź unikalność
    const existingSlug = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "Tenant o takim identyfikatorze już istnieje" },
        { status: 400 }
      );
    }

    const existingDomain = await prisma.tenant.findUnique({
      where: { domain: data.domain },
    });

    if (existingDomain) {
      return NextResponse.json(
        { error: "Tenant o takiej domenie już istnieje" },
        { status: 400 }
      );
    }

    // SQLite wymaga stringów JSON!
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        domain: data.domain,
        domains: JSON.stringify(data.domains || []), // <-- STRING
        apiKey: generateApiKey(),
        settings: JSON.stringify(data.settings || {}), // <-- STRING
        isActive: true,
      },
    });

    // Strona główna - też JSON jako string
    await prisma.page.create({
      data: {
        tenantId: tenant.id,
        slug: "index",
        title: "Strona główna",
        description: data.settings?.description || `Witamy na ${data.name}`,
        content: JSON.stringify({
          html: `<h1>Witamy na ${data.name}!</h1><p>To jest strona główna.</p>`,
        }),
        seo: "{}",
        status: "PUBLISHED",
        template: "home",
        authorId: session.user.id,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Create tenant error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}
