'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  FileText, 
  Settings, 
  LogOut, 
  ChevronDown,
  Plus,
  User
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { SessionUser } from '@/lib/auth';

interface SidebarProps {
  user: SessionUser;
  tenants: { id: string; name: string; domain: string }[];
}

export function Sidebar({ user, tenants }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantsOpen, setTenantsOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  
  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };
  
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">MultiSite CMS</h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavLink href="/dashboard" icon={LayoutDashboard} active={pathname === '/dashboard'}>
          Dashboard
        </NavLink>
        
        {/* Tenants Section */}
        <div className="pt-4">
          <button
            onClick={() => setTenantsOpen(!tenantsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Strony klientów
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              tenantsOpen && "rotate-180"
            )} />
          </button>
          
          {tenantsOpen && (
            <div className="mt-1 space-y-1 ml-4">
              {tenants.map((tenant) => (
                <NavLink
                  key={tenant.id}
                  href={`/dashboard/tenants/${tenant.id}`}
                  active={pathname.startsWith(`/dashboard/tenants/${tenant.id}`)}
                  small
                >
                  <span className="truncate">{tenant.name}</span>
                  <span className="text-xs text-gray-400 truncate">{tenant.domain}</span>
                </NavLink>
              ))}
              
              {isSuperAdmin && (
                <NavLink
                  href="/dashboard/tenants/new"
                  icon={Plus}
                  active={pathname === '/dashboard/tenants/new'}
                  small
                >
                  Dodaj klienta
                </NavLink>
              )}
            </div>
          )}
        </div>
        
        {/* Admin Section */}
        {isSuperAdmin && (
          <div className="pt-4">
            <NavLink href="/dashboard/settings" icon={Settings} active={pathname === '/dashboard/settings'}>
              Ustawienia
            </NavLink>
          </div>
        )}
      </nav>
      
      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-500 truncate">{user.role}</p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? 'Wylogowywanie...' : 'Wyloguj się'}
        </button>
      </div>
    </aside>
  );
}

interface NavLinkProps {
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  small?: boolean;
  children: React.ReactNode;
}

function NavLink({ href, icon: Icon, active, small, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
        small ? "text-sm" : "text-sm font-medium",
        active 
          ? "bg-blue-50 text-blue-700" 
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      )}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      <span className="flex-1 flex flex-col">{children}</span>
    </Link>
  );
}
