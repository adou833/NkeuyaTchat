'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface UserRecord {
  id: string;
  full_name: string;
  status: 'en_attente' | 'valide' | 'refuse';
  salons: string[];
}

const ALL_SALONS = ['general', 'photo-famille-nkeuya', 'reunions', 'projets'];

export default function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const currentUser = localStorage.getItem('chat_user');
    if (!currentUser || currentUser.toLowerCase() !== 'eric mabom') {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setUsers(data as UserRecord[]);
    }
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, status: 'valide' | 'refuse') => {
    await supabase.from('users').update({ status }).eq('id', userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status } : u))
    );
  };

  const toggleSalon = async (user: UserRecord, salon: string) => {
    const updatedSalons = user.salons.includes(salon)
      ? user.salons.filter((s) => s !== salon)
      : [...user.salons, salon];

    await supabase.from('users').update({ salons: updatedSalons }).eq('id', user.id);
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, salons: updatedSalons } : u))
    );
  };

  return (
    <main className="h-[100dvh] w-screen flex items-center justify-center bg-[#222222] p-0 sm:p-4 overflow-hidden">
      {/* Conteneur simulant l'écran Android aux coins arrondis */}
      <div className="w-full h-full sm:max-w-md sm:max-h-[900px] bg-[#111b21] sm:rounded-[38px] shadow-2xl flex flex-col overflow-hidden relative sm:border-4 sm:border-gray-800">
        
        {/* En-tête du Panneau Admin */}
        <div className="bg-[#202c33] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0 border-b border-gray-700">
          <div>
            <h1 className="text-base font-bold text-emerald-400">Administration</h1>
            <p className="text-[11px] text-gray-400">Gestion des membres NkeuyaTchat</p>
          </div>
          <button
            onClick={() => router.push('/salon/general')}
            className="bg-[#00a884] hover:bg-[#008f72] text-white text-xs px-3 py-1.5 rounded-lg transition font-medium shadow"
          >
            Aller au Chat
          </button>
        </div>

        {/* Corps de la page admin (défilable en interne) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Demandes et Membres de la Famille
          </h2>

          {loading ? (
            <p className="text-xs text-gray-400 text-center py-6">Chargement des membres...</p>
          ) : users.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Aucun utilisateur enregistré pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-[#202c33] p-3.5 rounded-xl border border-gray-700 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-200">{u.full_name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        u.status === 'valide'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                          : u.status === 'refuse'
                          ? 'bg-red-950 text-red-400 border border-red-700'
                          : 'bg-amber-950 text-amber-400 border border-amber-700'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>

                  {/* Salons autorisés (Cocher / Décocher) */}
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1">Salons autorisés :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_SALONS.map((salon) => {
                        const isChecked = u.salons.includes(salon);
                        return (
                          <button
                            key={salon}
                            type="button"
                            onClick={() => toggleSalon(u, salon)}
                            className={`text-[11px] px-2.5 py-1 rounded-md transition font-medium border ${
                              isChecked
                                ? 'bg-[#005c4b] text-white border-emerald-600 shadow-sm'
                                : 'bg-[#111b21] text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            #{salon}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-700/60 justify-end">
                    {u.status !== 'valide' && (
                      <button
                        onClick={() => updateUserStatus(u.id, 'valide')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg transition font-medium shadow"
                      >
                        Valider
                      </button>
                    )}
                    {u.status !== 'refuse' && (
                      <button
                        onClick={() => updateUserStatus(u.id, 'refuse')}
                        className="bg-red-600/80 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition font-medium"
                      >
                        Refuser
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}