import { getSession, hashPassword, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface Props {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET /api/users/[id] - Pobierz użytkownika
// =============================================================================

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json(
        { error: "Użytkownik nie znaleziony" },
        { status: 404 }
      );
    }

    // Sprawdź uprawnienia
    if (!isSuperAdmin(session)) {
      if (session.user.role !== "ADMIN" || session.user.tenantId !== user.tenantId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/users/[id] - Aktualizuj użytkownika
// =============================================================================

const updateUserSchema = z.object({
  email: z.string().email("Nieprawidłowy email").optional(),
  name: z.string().min(1, "Imię jest wymagane").optional(),
  password: z.string().min(6, "Hasło musi mieć min. 6 znaków").optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Użytkownik nie znaleziony" },
        { status: 404 }
      );
    }

    // Sprawdź uprawnienia
    const canEdit = isSuperAdmin(session) || 
      (session.user.role === "ADMIN" && session.user.tenantId === existingUser.tenantId);

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // Admin tenanta nie może zmieniać roli na ADMIN
    if (!isSuperAdmin(session) && data.role === "ADMIN") {
      return NextResponse.json(
        { error: "Nie możesz nadać roli Admin" },
        { status: 403 }
      );
    }

    // Nie można edytować SUPER_ADMIN
    if (existingUser.role === "SUPER_ADMIN" && !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Nie możesz edytować Super Admina" },
        { status: 403 }
      );
    }

    // Sprawdź unikalność emaila jeśli się zmienia
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: "Email jest już zajęty" },
          { status: 400 }
        );
      }
    }

    // Przygotuj dane do aktualizacji
    const updateData: Record<string, unknown> = {};
    if (data.email) updateData.email = data.email;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;
    if (data.password) updateData.passwordHash = await hashPassword(data.password);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/users/[id] - Usuń użytkownika
// =============================================================================

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Użytkownik nie znaleziony" },
        { status: 404 }
      );
    }

    // Sprawdź uprawnienia
    const canDelete = isSuperAdmin(session) || 
      (session.user.role === "ADMIN" && session.user.tenantId === existingUser.tenantId);

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Nie można usunąć SUPER_ADMIN
    if (existingUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Nie można usunąć Super Admina" },
        { status: 403 }
      );
    }

    // Nie można usunąć siebie
    if (existingUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Nie możesz usunąć swojego konta" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}
