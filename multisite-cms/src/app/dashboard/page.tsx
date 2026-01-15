import { getSession, isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Globe, FileText, Users, Rocket } from 'lucide-react';

export default async function DashboardPage() {
  const session = await getSession();
  const isAdmin = isSuperAdmin(session);
  
  // Pobierz statystyki
  const tenantFilter = isAdmin ? {} : { id: session?.user.tenantId || '' };
  
  const [tenantsCount, pagesCount, usersCount, deploymentsCount] = await Promise.all([
    isAdmin 
      ? prisma.tenant.count({ where: { isActive: true } })
      : 1,
    prisma.page.count({
      where: isAdmin 
        ? {} 
        : { tenantId: session?.user.tenantId || '' },
    }),
    isAdmin
      ? prisma.user.count({ where: { isActive: true } })
      : prisma.user.count({ where: { tenantId: session?.user.tenantId || '' } }),
    prisma.deployment.count({
      where: {
        ...(isAdmin ? {} : { tenantId: session?.user.tenantId || '' }),
        status: 'SUCCESS',
      },
    }),
  ]);
  
  // Ostatnie deploye
  const recentDeployments = await prisma.deployment.findMany({
    where: isAdmin ? {} : { tenantId: session?.user.tenantId || '' },
    include: { tenant: { select: { name: true, domain: true } } },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });
  
  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Witaj, {session?.user.name || 'Użytkowniku'}! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {isAdmin ? 'Panel administracyjny' : 'Panel zarządzania stroną'}
        </p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Globe}
          label={isAdmin ? "Klienci" : "Strona"}
          value={tenantsCount}
          color="blue"
        />
        <StatCard
          icon={FileText}
          label="Strony"
          value={pagesCount}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Użytkownicy"
          value={usersCount}
          color="purple"
        />
        <StatCard
          icon={Rocket}
          label="Deploye"
          value={deploymentsCount}
          color="orange"
        />
      </div>
      
      {/* Recent Deployments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ostatnie deploye</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentDeployments.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Brak deployów
            </div>
          ) : (
            recentDeployments.map((deploy) => (
              <div key={deploy.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{deploy.tenant.name}</p>
                  <p className="text-sm text-gray-500">{deploy.tenant.domain}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    deploy.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                    deploy.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    deploy.status === 'BUILDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {deploy.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(deploy.startedAt).toLocaleString('pl-PL')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
