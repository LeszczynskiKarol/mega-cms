import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await getSession();
  
  if (session) {
    redirect('/dashboard');
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">MultiSite CMS</h1>
            <p className="text-gray-500 mt-2">Zaloguj się do panelu</p>
          </div>
          
          <LoginForm />
        </div>
        
        <p className="text-center text-gray-400 text-sm mt-6">
          © {new Date().getFullYear()} Twoja Firma
        </p>
      </div>
    </div>
  );
}
