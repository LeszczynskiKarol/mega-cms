import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from './sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session) {
    redirect('/');
  }
  
  // Pobierz listę tenantów dla sidebar
  let tenants: { id: string; name: string; domain: string }[] = [];
  
  if (isSuperAdmin(session)) {
    // Super admin widzi wszystkich
    tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, domain: true },
      orderBy: { name: 'asc' },
    });
  } else if (session.user.tenantId) {
    // Zwykły user widzi tylko swojego tenanta
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { id: true, name: true, domain: true },
    });
    if (tenant) {
      tenants = [tenant];
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={session.user} tenants={tenants} />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
