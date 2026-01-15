import { notFound, redirect } from 'next/navigation';
import { getSession, requireTenant, canEditPages } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageEditor } from './page-editor';

interface Props {
  params: Promise<{ id: string; pageId: string }>;
}

export default async function EditPagePage({ params }: Props) {
  const { id, pageId } = await params;
  const session = await getSession();
  
  if (!session) {
    redirect('/');
  }
  
  // Sprawdź uprawnienia
  try {
    await requireTenant(id);
  } catch {
    notFound();
  }
  
  if (!canEditPages(session, id)) {
    notFound();
  }
  
  // Pobierz tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, name: true, domain: true },
  });
  
  if (!tenant) {
    notFound();
  }
  
  // Pobierz stronę (jeśli nie "new")
  let page = null;
  if (pageId !== 'new') {
    page = await prisma.page.findFirst({
      where: {
        id: pageId,
        tenantId: id,
      },
    });
    
    if (!page) {
      notFound();
    }
  }
  
  // Pobierz listę stron dla wyboru parenta
  const pages = await prisma.page.findMany({
    where: {
      tenantId: id,
      id: { not: pageId === 'new' ? undefined : pageId },
    },
    select: { id: true, title: true, slug: true },
    orderBy: { title: 'asc' },
  });
  
  return (
    <div className="max-w-4xl">
      <PageEditor
        tenant={tenant}
        page={page}
        availableParents={pages}
      />
    </div>
  );
}
