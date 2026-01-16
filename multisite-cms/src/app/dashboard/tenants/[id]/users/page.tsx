import { getSession, isSuperAdmin, requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Mail, Shield, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddUserForm } from "./add-user-form";
import { UserActions } from "./user-actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TenantUsersPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  try {
    await requireTenant(id);
  } catch {
    notFound();
  }

  // Tylko SUPER_ADMIN lub ADMIN tenanta może zarządzać użytkownikami
  const canManageUsers =
    isSuperAdmin(session) ||
    (session.user.tenantId === id && session.user.role === "ADMIN");

  if (!canManageUsers) {
    redirect(`/dashboard/tenants/${id}`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
  });

  if (!tenant) {
    notFound();
  }

  const users = await prisma.user.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrator",
    EDITOR: "Edytor",
    VIEWER: "Czytelnik",
  };

  const roleColors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    EDITOR: "bg-blue-100 text-blue-800",
    VIEWER: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/tenants/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do {tenant.name}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Użytkownicy</h1>
            <p className="text-gray-500 mt-1">
              Zarządzaj użytkownikami dla {tenant.name}
            </p>
          </div>
        </div>
      </div>

      {/* Add User Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Dodaj użytkownika
        </h2>
        <AddUserForm tenantId={id} isSuperAdmin={isSuperAdmin(session)} />
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Lista użytkowników ({users.length})
          </h2>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Brak użytkowników</p>
            <p className="text-sm text-gray-400 mt-1">
              Dodaj pierwszego użytkownika używając formularza powyżej
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <div
                key={user.id}
                className={`px-6 py-4 flex items-center justify-between ${
                  !user.isActive ? "bg-gray-50 opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {user.name || "Bez nazwy"}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          roleColors[user.role] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {roleLabels[user.role] || user.role}
                      </span>
                      {!user.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Nieaktywny
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                    {user.lastLoginAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Ostatnie logowanie:{" "}
                        {new Date(user.lastLoginAt).toLocaleString("pl-PL")}
                      </p>
                    )}
                  </div>
                </div>

                <UserActions
                  user={user}
                  currentUserId={session.user.id}
                  isSuperAdmin={isSuperAdmin(session)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
