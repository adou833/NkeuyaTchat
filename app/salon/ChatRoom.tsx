'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatRoom({ salonId }: { salonId: string }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function verifyAndLoad() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (authError || !user) {
          router.push('/');
          return;
        }

        setAuthorized(true);
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err.message || 'Erreur lors du chargement du salon');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyAndLoad();

    return () => {
      isMounted = false;
    };
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b141a] text-[#8696a0]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent"></div>
          <p className="text-sm font-medium">Ouverture du salon...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b141a] text-red-400 p-4">
        <p>Erreur : {errorMsg}</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex h-screen bg-[#0b141a] text-white">
      <div className="flex-1 flex flex-col">
        <header className="p-4 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between">
          <h1 className="text-lg font-semibold">Salon : {salonId}</h1>
          <button 
            onClick={() => router.push('/')}
            className="text-sm bg-[#00a884] text-white px-3 py-1 rounded"
          >
            Retour
          </button>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
          <p className="text-sm text-[#8696a0]">Bienvenue dans le salon {salonId}. Les messages se chargeront ici.</p>
        </main>
      </div>
    </div>
  );
}