import { getSession, hashPassword, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// =============================================================================
// GET /api/users - Lista użytkowników
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    let users;

    if (isSuperAdmin(session)) {
      // Super admin widzi wszystkich lub filtruje po tenancie
      users = await prisma.user.findMany({
        where: tenantId ? { tenantId } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          tenant: {
            select: { name: true, domain: true },
          },
        },
      });
    } else if (session.user.tenantId && session.user.role === "ADMIN") {
      // Admin tenanta widzi tylko użytkowników swojego tenanta
      users = await prisma.user.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/users - Utwórz nowego użytkownika
// =============================================================================

const createUserSchema = z.object({
  email: z.string().email("Nieprawidłowy email"),
  name: z.string().min(1, "Imię jest wymagane"),
  password: z.string().min(6, "Hasło musi mieć min. 6 znaków"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  tenantId: z.string().min(1, "Tenant jest wymagany"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Sprawdź uprawnienia
    if (isSuperAdmin(session)) {
      // Super admin może tworzyć użytkowników dla dowolnego tenanta
    } else if (
      session.user.role === "ADMIN" &&
      session.user.tenantId === data.tenantId
    ) {
      // Admin tenanta może tworzyć użytkowników tylko dla swojego tenanta
      // i nie może tworzyć innych adminów
      if (data.role === "ADMIN") {
        return NextResponse.json(
          { error: "Nie możesz tworzyć użytkowników z rolą Admin" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Sprawdź czy tenant istnieje
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant nie istnieje" },
        { status: 400 }
      );
    }

    // Sprawdź unikalność emaila
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Użytkownik o takim emailu już istnieje" },
        { status: 400 }
      );
    }

    // Utwórz użytkownika
    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role,
        tenantId: data.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}
