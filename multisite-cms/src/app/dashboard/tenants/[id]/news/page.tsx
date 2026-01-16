import { getSession, isSuperAdmin, requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Calendar, Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteNewsButton } from "./delete-news-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TenantNewsPage({ params }: Props) {
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
  });

  if (!tenant) {
    notFound();
  }

  // Pobierz aktualności (strony z template="news")
  const news = await prisma.page.findMany({
    where: {
      tenantId: id,
      template: "news",
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      content: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      author: {
        select: { name: true },
      },
    },
  });

  const canEdit =
    isSuperAdmin(session) ||
    (session.user.tenantId === id &&
      ["ADMIN", "EDITOR"].includes(session.user.role));

  // Parsuj content żeby wyciągnąć obrazek
  const newsWithImages = news.map((item) => {
    let image = null;
    try {
      const content = typeof item.content === "string" 
        ? JSON.parse(item.content) 
        : item.content;
      image = content?.image || null;
    } catch {
      // ignore
    }
    return { ...item, image };
  });

  return (
    <div className="max-w-6xl">
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
            <h1 className="text-2xl font-bold text-gray-900">Aktualności</h1>
            <p className="text-gray-500 mt-1">
              Zarządzaj aktualnościami dla {tenant.name}
            </p>
          </div>

          {canEdit && (
            <Link
              href={`/dashboard/tenants/${id}/news/new`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nowa aktualność
            </Link>
          )}
        </div>
      </div>

      {/* News List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Lista aktualności ({newsWithImages.length})
          </h2>
        </div>

        {newsWithImages.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Brak aktualności</p>
            {canEdit && (
              <Link
                href={`/dashboard/tenants/${id}/news/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Dodaj pierwszą aktualność
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {newsWithImages.map((item) => (
              <div
                key={item.id}
                className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50"
              >
                {/* Thumbnail */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <FileText className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {item.title}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800"
                          : item.status === "DRAFT"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.status === "PUBLISHED"
                        ? "Opublikowana"
                        : item.status === "DRAFT"
                        ? "Szkic"
                        : "Zarchiwizowana"}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString("pl-PL")
                        : "Nie opublikowano"}
                    </span>
                    {item.author?.name && (
                      <span>Autor: {item.author.name}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {item.status === "PUBLISHED" && (
                    <a
                      href={`https://${tenant.domain}/aktualnosci/${item.slug}`}
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
                        href={`/dashboard/tenants/${id}/news/${item.id}`}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Edytuj"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>

                      <DeleteNewsButton
                        newsId={item.id}
                        newsTitle={item.title}
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
