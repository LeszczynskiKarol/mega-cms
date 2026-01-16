import { getSession, isSuperAdmin, requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NewsEditor } from "./news-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewNewsPage({ params }: Props) {
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

  const canEdit =
    isSuperAdmin(session) ||
    (session.user.tenantId === id &&
      ["ADMIN", "EDITOR"].includes(session.user.role));

  if (!canEdit) {
    redirect(`/dashboard/tenants/${id}/news`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
  });

  if (!tenant) {
    notFound();
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/tenants/${id}/news`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do aktualności
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">Nowa aktualność</h1>
        <p className="text-gray-500 mt-1">
          Dodaj nową aktualność dla {tenant.name}
        </p>
      </div>

      <NewsEditor tenantId={id} />
    </div>
  );
}
