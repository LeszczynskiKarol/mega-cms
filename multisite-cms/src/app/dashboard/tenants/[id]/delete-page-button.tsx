'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

interface DeletePageButtonProps {
  pageId: string;
  pageTitle: string;
}

export function DeletePageButton({ pageId, pageTitle }: DeletePageButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  
  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    
    setDeleting(true);
    
    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };
  
  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">Usunąć?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 text-red-600 hover:bg-red-50 rounded"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tak'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="p-2 text-gray-400 hover:bg-gray-50 rounded"
        >
          Nie
        </button>
      </div>
    );
  }
  
  return (
    <button
      onClick={handleDelete}
      className="p-2 text-gray-400 hover:text-red-600"
      title="Usuń"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
