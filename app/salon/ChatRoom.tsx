'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatRoom({ salonId }: { salonId: string }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function verifyUser() {
      // Utilisation de getUser() qui interroge directement le serveur/token de manière fiable
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error || !user) {
        router.push('/');
      } else {
        setAuthorized(true);
      }
      setLoading(false);
    }

    verifyUser();

    // Écoute des changements d'état (connexion/déconnexion en direct)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (!session) {
        router.push('/');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b141a] text-[#8696a0]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent"></div>
          <p className="text-sm font-medium">Chargement du salon...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex h-screen bg-[#0b141a] text-white">
      {/* Contenu principal du salon */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 bg-[#202c33] border-b border-[#222d34]">
          <h1 className="text-lg font-semibold">Salon : {salonId}</h1>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Messages du chat */}
          <p className="text-sm text-[#8696a0]">Bienvenue dans le salon de discussion.</p>
        </main>
      </div>
    </div>
  );
}