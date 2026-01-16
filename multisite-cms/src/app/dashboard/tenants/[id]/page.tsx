import { getSession, isSuperAdmin, requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExternalLink, Eye, FileText, Newspaper, Pencil, Plus, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "./copy-button";
import { DeletePageButton } from "./delete-page-button";
import { DeployButton } from "./deploy-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TenantPage({ params }: Props) {
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

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      pages: {
        where: { template: { not: "news" } }, // Exclude news from pages list
        orderBy: [{ order: "asc" }, { title: "asc" }],
        include: {
          author: {
            select: { name: true, email: true },
          },
        },
      },
      users: {
        select: { id: true },
      },
      _count: {
        select: { deployments: true },
      },
    },
  });

  // Count news separately
  const newsCount = await prisma.page.count({
    where: {
      tenantId: id,
      template: "news",
    },
  });

  if (!tenant) {
    notFound();
  }

  const lastDeployment = await prisma.deployment.findFirst({
    where: { tenantId: id },
    orderBy: { startedAt: "desc" },
  });

  const canEdit =
    isSuperAdmin(session) ||
    (session.user.tenantId === id &&
      ["ADMIN", "EDITOR"].includes(session.user.role));

  const canManageUsers =
    isSuperAdmin(session) ||
    (session.user.tenantId === id && session.user.role === "ADMIN");

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <a
              href={`https://${tenant.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {tenant.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DeployButton tenantId={tenant.id} lastDeployment={lastDeployment} />

          {canEdit && (
            <Link
              href={`/dashboard/tenants/${id}/news`}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              <Newspaper className="h-4 w-4" />
              Aktualności ({newsCount})
            </Link>
          )}

          {canManageUsers && (
            <Link
              href={`/dashboard/tenants/${id}/users`}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Users className="h-4 w-4" />
              Użytkownicy ({tenant.users.length})
            </Link>
          )}

          {canEdit && (
            <Link
              href={`/dashboard/tenants/${id}/pages/new`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nowa strona
            </Link>
          )}
        </div>
      </div>

      {/* API Key Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">API Key</p>
          <code className="text-sm text-gray-500">{tenant.apiKey}</code>
        </div>
        <CopyButton text={tenant.apiKey} />
      </div>

      {/* Pages List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Strony ({tenant.pages.length})
          </h2>
        </div>

        {tenant.pages.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Brak stron</p>
            {canEdit && (
              <Link
                href={`/dashboard/tenants/${id}/pages/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Dodaj pierwszą stronę
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tenant.pages.map((page) => (
              <div
                key={page.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {page.title}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        page.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800"
                          : page.status === "DRAFT"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {page.status === "PUBLISHED"
                        ? "Opublikowana"
                        : page.status === "DRAFT"
                        ? "Szkic"
                        : "Zarchiwizowana"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">/{page.slug}</p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {page.status === "PUBLISHED" && (
                    <a
                      href={`https://${tenant.domain}/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Podgląd"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  )}

                  {canEdit && (
                    <>
                      <Link
                        href={`/dashboard/tenants/${id}/pages/${page.id}`}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Edytuj"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>

                      <DeletePageButton
                        pageId={page.id}
                        pageTitle={page.title}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
