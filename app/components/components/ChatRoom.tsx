'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  content: string;
  username: string;
  salon_id: string;
  created_at: string;
}

interface UserRecord {
  id: string;
  full_name: string;
  status: 'en_attente' | 'valide' | 'refuse';
  salons: string[];
  password?: string;
}

// Les 6 Salons Officiels de NkeuyaTchat
const OFFICIAL_SALONS = [
  { id: 'general', label: 'Général' },
  { id: 'femmes', label: 'Femmes' },
  { id: 'hommes', label: 'Hommes' },
  { id: 'filles', label: 'Filles' },
  { id: 'garcons', label: 'Garçons' },
  { id: 'petits-fils-et-filles', label: 'Petits fils et filles' },
];

export default function ChatRoom({ salonId }: { salonId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [fullName, setFullName] = useState('');
  const [allowedSalons, setAllowedSalons] = useState<string[]>([]);
  const [allSalons, setAllSalons] = useState<string[]>(OFFICIAL_SALONS.map(s => s.id));
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // États Administrateur
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'passwords' | 'en_ligne' | 'moderation' | 'salons' | 'annonces'>('users');
  const [adminUsers, setAdminUsers] = useState<UserRecord[]>([]);
  const [adminMessages, setAdminMessages] = useState<Message[]>([]);
  const [newSalonName, setNewSalonName] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  
  // État de réinitialisation/création de mot de passe par l'admin
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const ADMIN_NAME = "Eric MABOM";
  const isAdmin = fullName.toLowerCase() === ADMIN_NAME.toLowerCase();

  // 1. Initialisation utilisateur et Suivi de Présence Realtime
  useEffect(() => {
    const user = localStorage.getItem('chat_user');
    const salons = localStorage.getItem('chat_salons');

    if (!user) {
      router.push('/');
      return;
    }

    setFullName(user);
    if (salons) {
      try {
        setAllowedSalons(JSON.parse(salons));
      } catch {
        setAllowedSalons(['general']);
      }
    } else {
      setAllowedSalons(OFFICIAL_SALONS.map(s => s.id));
    }

    const presenceChannel = supabase.channel('nkeuya_presence', {
      config: {
        presence: {
          key: user,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.keys(state);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [router]);

  // 2. Écoute temps réel des messages du salon
  useEffect(() => {
    if (!salonId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('salon_id', salonId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    };

    fetchMessages();

    const channel = supabase
      .channel(`room-${salonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT' && (payload.new as Message).salon_id === salonId) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === (payload.new as Message).id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId]);

  // 3. Charger les données d'admin si ouvert
  useEffect(() => {
    if (showAdminPanel && isAdmin) {
      fetchAdminData();
    }
  }, [showAdminPanel, isAdmin]);

  const fetchAdminData = async () => {
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (usersData) setAdminUsers(usersData);

    const { data: msgData } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);
    if (msgData) setAdminMessages(msgData);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envoyer un message avec affichage instantané
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !fullName) return;

    const contentToSend = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase.from('messages').insert([
      { content: contentToSend, username: fullName, salon_id: salonId },
    ]).select();

    if (data && data.length > 0) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === data[0].id);
        if (exists) return prev;
        return [...prev, data[0] as Message];
      });
    } else if (error) {
      alert("Erreur lors de l'envoi du message : " + error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_salons');
    router.push('/');
  };

  // --- FONCTIONS ADMINISTRATEUR ---

  // Changer le statut (Valider / Bloquer)
  const updateUserStatus = async (userId: string, status: 'valide' | 'refuse') => {
    await supabase.from('users').update({ status }).eq('id', userId);
    setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
  };

  // Suppression définitive du compte de la base de données Supabase
  const deleteUserAccount = async (user: UserRecord) => {
    if (!confirm(`⚠️ Attention : Voulez-vous vraiment SUPPRIMER le compte de "${user.full_name}" ? Il pourra ainsi refaire une nouvelle demande d'inscription.`)) return;

    const { error } = await supabase.from('users').delete().eq('id', user.id);

    if (error) {
      alert("Erreur lors de la suppression du compte : " + error.message);
    } else {
      setAdminUsers((prev) => prev.filter((u) => u.id !== user.id));
      alert(`Le compte de "${user.full_name}" a été supprimé avec succès.`);
    }
  };

  const forceResetUser = async (user: UserRecord) => {
    if (!confirm(`Voulez-vous forcer la remise en attente de validation pour ${user.full_name} ?`)) return;
    
    await supabase.from('users').update({ status: 'en_attente' }).eq('id', user.id);
    setAdminUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'en_attente' } : u)));
    alert(`Le compte de ${user.full_name} est repassé en attente de validation.`);
  };

  const handleSavePassword = async (userId: string, userName: string) => {
    if (!newPasswordInput.trim()) {
      alert("Veuillez saisir un mot de passe valide.");
      return;
    }

    const cleanPassword = newPasswordInput.trim();

    const { error } = await supabase
      .from('users')
      .update({ password: cleanPassword })
      .eq('id', userId);

    if (error) {
      alert("Erreur lors de la mise à jour du mot de passe : " + error.message);
    } else {
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, password: cleanPassword } : u))
      );
      alert(`Le mot de passe pour ${userName} a été mis à jour avec succès !`);
      setEditingPasswordUserId(null);
      setNewPasswordInput('');
    }
  };

  const toggleSalonUser = async (user: UserRecord, salon: string) => {
    const updatedSalons = user.salons?.includes(salon)
      ? user.salons.filter((s) => s !== salon)
      : [...(user.salons || []), salon];

    await supabase.from('users').update({ salons: updatedSalons }).eq('id', user.id);
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, salons: updatedSalons } : u))
    );
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('messages').delete().eq('id', msgId);
    setAdminMessages((prev) => prev.filter((m) => m.id !== msgId));
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const purgeSalon = async (targetSalon: string) => {
    if (!confirm(`⚠️ Attention : Voulez-vous vraiment effacer TOUS les messages de ce salon ?`)) return;

    await supabase.from('messages').delete().eq('salon_id', targetSalon);
    if (targetSalon === salonId) setMessages([]);
    fetchAdminData();
    alert(`Le salon a été purgé.`);
  };

  const handleAddSalon = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newSalonName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!formatted || allSalons.includes(formatted)) return;

    setAllSalons((prev) => [...prev, formatted]);
    setAllowedSalons((prev) => [...prev, formatted]);
    localStorage.setItem('chat_salons', JSON.stringify([...allowedSalons, formatted]));
    setNewSalonName('');
    alert(`Le salon a été créé avec succès !`);
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    const { data } = await supabase.from('messages').insert([
      {
        content: `📢 ANNONCE ADMIN : ${announcementText.trim()}`,
        username: '📢 Eric MABOM (ADMIN)',
        salon_id: salonId,
      },
    ]).select();

    if (data && data.length > 0) {
      setMessages((prev) => [...prev, data[0] as Message]);
    }

    setAnnouncementText('');
    setShowAdminPanel(false);
  };

  const currentSalonObj = OFFICIAL_SALONS.find(s => s.id === salonId) || { label: salonId };

  return (
    <div className="flex flex-col h-full w-full bg-[#efeae2] relative overflow-hidden">
      
      {/* En-tête */}
      <div className="bg-[#005c4b] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white shadow">
              {currentSalonObj.label.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#005c4b] rounded-full"></span>
          </div>
          <div>
            <h2 className="font-semibold text-base">#{currentSalonObj.label}</h2>
            <div className="text-[11px] text-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
              <span>{onlineUsers.length} en ligne ({onlineUsers.join(', ')})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition shadow ${
                showAdminPanel ? 'bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-gray-900'
              }`}
            >
              {showAdminPanel ? '💬 Retour Chat' : '⚙️ Admin'}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs bg-emerald-800 hover:bg-emerald-900 text-white px-2.5 py-1.5 rounded-lg transition"
          >
            Quitter
          </button>
        </div>
      </div>

      {/* PANNEAU ADMIN INTEGRÉ */}
      {isAdmin && showAdminPanel ? (
        <div className="flex-1 bg-[#111b21] text-white overflow-y-auto flex flex-col">
          
          <div className="bg-[#202c33] p-2 flex gap-1 border-b border-gray-700 overflow-x-auto shrink-0">
            {[
              { id: 'users', label: '👥 Membres' },
              { id: 'passwords', label: '🔑 Mots de passe' },
              { id: 'en_ligne', label: `🟢 En ligne (${onlineUsers.length})` },
              { id: 'moderation', label: '🛡️ Modération' },
              { id: 'salons', label: '💬 Salons' },
              { id: 'annonces', label: '📢 Annonce' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id as any)}
                className={`text-xs px-3 py-2 rounded-lg font-semibold transition shrink-0 ${
                  adminTab === tab.id
                    ? 'bg-[#005c4b] text-white shadow'
                    : 'bg-[#111b21] text-gray-400 hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 flex-1 space-y-4">
            
            {/* Onglet Membres */}
            {adminTab === 'users' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Gestion des Comptes et Sécurité
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Vous pouvez bloquer un accès, ou supprimer définitivement un compte pour permettre au membre de refaire une nouvelle inscription propre.
                  </p>
                </div>

                {adminUsers.map((u) => (
                  <div key={u.id} className="bg-[#202c33] p-3.5 rounded-xl border border-gray-700 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-bold text-sm text-gray-100">{u.full_name}</span>
                        <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                          u.status === 'valide' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          u.status === 'refuse' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {u.status === 'valide' ? 'Validé' : u.status === 'refuse' ? 'Bloqué' : 'En attente'}
                        </span>
                      </div>

                      {/* Bouton de Suppression Totale du Compte */}
                      <button
                        onClick={() => deleteUserAccount(u)}
                        className="text-[10px] bg-red-950 hover:bg-red-900 text-red-300 px-2.5 py-1.5 rounded-lg border border-red-800 transition font-bold shadow-sm"
                      >
                        🗑️ Supprimer le compte
                      </button>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block mb-1">Salons autorisés :</span>
                      <div className="flex flex-wrap gap-1.5">
                        {allSalons.map((sId) => {
                          const sObj = OFFICIAL_SALONS.find(os => os.id === sId) || { label: sId };
                          const hasAccess = u.salons?.includes(sId);
                          return (
                            <button
                              key={sId}
                              onClick={() => toggleSalonUser(u, sId)}
                              className={`text-[10px] px-2 py-1 rounded border transition font-medium ${
                                hasAccess ? 'bg-[#005c4b] text-white border-emerald-600' : 'bg-[#111b21] text-gray-400 border-gray-700'
                              }`}
                            >
                              #{sObj.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-700/60 flex-wrap gap-2">
                      <button
                        onClick={() => forceResetUser(u)}
                        className="text-[10px] bg-amber-900/60 hover:bg-amber-900 text-amber-300 px-2 py-1 rounded border border-amber-700 transition"
                      >
                        🔄 Remettre en attente
                      </button>

                      <div className="flex gap-1.5">
                        {u.status !== 'valide' && (
                          <button 
                            onClick={() => updateUserStatus(u.id, 'valide')} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-3 py-1 rounded font-semibold transition"
                          >
                            ✓ Valider / Débloquer
                          </button>
                        )}
                        {u.status !== 'refuse' && (
                          <button 
                            onClick={() => updateUserStatus(u.id, 'refuse')} 
                            className="bg-red-600 hover:bg-red-700 text-white text-[11px] px-3 py-1 rounded font-semibold transition"
                          >
                            🚫 Bloquer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Onglet Gestion des Mots de Passe */}
            {adminTab === 'passwords' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Création & Réinitialisation des Mots de Passe
                </h3>
                {adminUsers.map((u) => (
                  <div key={u.id} className="bg-[#202c33] p-3.5 rounded-xl border border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-gray-100">{u.full_name}</span>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Statut mot de passe : {u.password ? (
                            <span className="text-emerald-400 font-medium">Créé (••••••••)</span>
                          ) : (
                            <span className="text-amber-400 font-medium">Non défini</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingPasswordUserId(editingPasswordUserId === u.id ? null : u.id);
                          setNewPasswordInput('');
                        }}
                        className="text-xs bg-[#005c4b] hover:bg-[#00483a] text-white px-3 py-1.5 rounded-lg font-medium transition"
                      >
                        {editingPasswordUserId === u.id ? 'Annuler' : u.password ? '🔑 Réinitialiser' : '➕ Créer'}
                      </button>
                    </div>

                    {editingPasswordUserId === u.id && (
                      <div className="pt-2 border-t border-gray-700 flex gap-2">
                        <input
                          type="text"
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="Nouveau mot de passe"
                          className="flex-1 bg-[#111b21] border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => handleSavePassword(u.id, u.full_name)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold"
                        >
                          Enregistrer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Onglet Personnes en ligne */}
            {adminTab === 'en_ligne' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Membres connectés en direct ({onlineUsers.length})
                </h3>
                <div className="space-y-2">
                  {onlineUsers.map((name, index) => (
                    <div key={index} className="bg-[#202c33] p-3 rounded-lg border border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                        <span className="text-xs font-bold text-gray-100">{name}</span>
                      </div>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                        En ligne
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Onglet Modération */}
            {adminTab === 'moderation' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Suppression de Messages Indésirables
                </h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {adminMessages.map((msg) => (
                    <div key={msg.id} className="bg-[#202c33] p-3 rounded-lg border border-gray-700 flex items-center justify-between gap-2">
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-emerald-400">{msg.username}</span>
                          <span className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">#{msg.salon_id}</span>
                        </div>
                        <p className="text-xs text-gray-200 mt-0.5 truncate">{msg.content}</p>
                      </div>
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2.5 py-1.5 rounded shrink-0 font-medium transition"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Onglet Salons */}
            {adminTab === 'salons' && (
              <div className="space-y-4">
                <form onSubmit={handleAddSalon} className="bg-[#202c33] p-3.5 rounded-xl border border-gray-700 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase">Créer un nouveau salon</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSalonName}
                      onChange={(e) => setNewSalonName(e.target.value)}
                      placeholder="Ex: rejouissances"
                      className="flex-1 bg-[#111b21] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button type="submit" className="bg-[#00a884] text-white text-xs px-3 py-2 rounded-lg font-bold">
                      Ajouter
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase">Salons Actifs</h4>
                  {allSalons.map((sId) => {
                    const sObj = OFFICIAL_SALONS.find(os => os.id === sId) || { label: sId };
                    return (
                      <div key={sId} className="bg-[#202c33] p-3 rounded-lg border border-gray-700 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-200">#{sObj.label}</span>
                        <button
                          onClick={() => purgeSalon(sId)}
                          className="bg-red-950 text-red-400 border border-red-800 hover:bg-red-900 text-[10px] px-2.5 py-1 rounded font-medium transition"
                        >
                          🗑️ Purger les messages
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Onglet Annonce */}
            {adminTab === 'annonces' && (
              <form onSubmit={handleSendAnnouncement} className="bg-[#202c33] p-4 rounded-xl border border-gray-700 space-y-3">
                <h3 className="text-xs font-bold text-emerald-400 uppercase">Diffuser une annonce officielle</h3>
                <p className="text-[11px] text-gray-400">
                  Cette annonce sera affichée sous forme de message prioritaire dans le salon actuel (#{currentSalonObj.label}).
                </p>
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Tapez votre message d'information pour la famille..."
                  rows={4}
                  className="w-full bg-[#111b21] border border-gray-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-2.5 rounded-lg text-xs transition">
                  📢 Publier l'annonce maintenant
                </button>
              </form>
            )}

          </div>
        </div>
      ) : (
        <>
          {/* Barre des Salons Officiels */}
          <div className="bg-[#f0f2f5] px-3 py-2 flex gap-2 overflow-x-auto border-b border-gray-300 text-xs shrink-0">
            {OFFICIAL_SALONS.map((s) => {
              if (!allowedSalons.includes(s.id) && !isAdmin) return null;
              const isActive = salonId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => router.push(`/salon/${s.id}`)}
                  className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition shadow-sm ${
                    isActive ? 'bg-[#005c4b] text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  #{s.label}
                </button>
              );
            })}
          </div>

          {/* Fil des messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#e5ddd5_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((msg) => {
              const isMe = msg.username === fullName;
              const isAnnouncement = msg.username.includes('ADMIN');

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3.5 py-2 text-sm shadow-sm relative ${
                    isAnnouncement ? 'bg-amber-100 border-2 border-amber-400 text-amber-950 font-medium' :
                    isMe ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                  }`}>
                    {!isMe && (
                      <span className="block text-[11px] font-bold text-[#005c4b] mb-0.5">{msg.username}</span>
                    )}
                    <p className="break-words leading-relaxed">{msg.content}</p>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      {isAdmin && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="text-[9px] text-red-600 hover:underline font-semibold"
                          title="Supprimer ce message indésirable"
                        >
                          Supprimer
                        </button>
                      )}
                      <span className="text-[9px] text-gray-400">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Barre de saisie */}
          <form onSubmit={handleSendMessage} className="bg-[#f0f2f5] px-3 py-3 flex items-center gap-2 border-t border-gray-300 shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Tapez un message..."
              className="flex-1 bg-white border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[#005c4b]"
            />
            <button type="submit" className="bg-[#00a884] hover:bg-[#008f72] text-white p-2.5 rounded-full transition shadow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.933.75.75 0 0 0 0-1.284A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </form>
        </>
      )}

    </div>
  );
}