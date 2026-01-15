import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { TenantForm } from './tenant-form';

export default async function NewTenantPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/');
  }
  
  if (!isSuperAdmin(session)) {
    redirect('/dashboard');
  }
  
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dodaj nowego klienta</h1>
        <p className="text-gray-500 mt-1">Utwórz nowego tenanta w systemie</p>
      </div>
      
      <TenantForm />
    </div>
  );
}
