'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2 } from 'lucide-react';

interface DeployButtonProps {
  tenantId: string;
  lastDeployment?: {
    status: string;
    startedAt: Date;
  } | null;
}

export function DeployButton({ tenantId, lastDeployment }: DeployButtonProps) {
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState('');
  
  const handleDeploy = async () => {
    if (deploying) return;
    
    setDeploying(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setMessage(data.error || 'Błąd deployu');
        return;
      }
      
      setMessage('Deploy uruchomiony!');
      router.refresh();
    } catch {
      setMessage('Wystąpił błąd');
    } finally {
      setDeploying(false);
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className={`text-sm ${message.includes('Błąd') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </span>
      )}
      
      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {deploying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {deploying ? 'Deploying...' : 'Deploy'}
      </button>
    </div>
  );
}
