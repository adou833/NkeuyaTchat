'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  content: string;
  username: string;
  sender?: string;
  salon: string;
  file_url?: string;
  file_type?: 'image' | 'audio' | 'video' | 'document';
  created_at: string;
}

interface UserRecord {
  id: string;
  full_name: string;
  status: 'en_attente' | 'valide' | 'refuse';
  salons: string[];
  password?: string;
}

const DEFAULT_SALONS = [
  { id: 'general', label: 'Général' },
  { id: 'photos-familiales', label: 'Photos familiales' },
  { id: 'femmes', label: 'Femmes' },
  { id: 'hommes', label: 'Hommes' },
  { id: 'filles', label: 'Filles' },
  { id: 'garcons', label: 'Garçons' },
  { id: 'petits-fils-et-filles', label: 'Petits fils et filles' },
];

const SALON_COLORS: Record<string, { bg: string, text: string, lightBg: string, border: string }> = {
  'general': { bg: '#005c4b', text: '#005c4b', lightBg: '#e6f4f1', border: '#005c4b' },
  'photos-familiales': { bg: '#d97706', text: '#b45309', lightBg: '#fef3c7', border: '#f59e0b' },
  'femmes': { bg: '#db2777', text: '#be185d', lightBg: '#fce7f3', border: '#f472b6' },
  'hommes': { bg: '#2563eb', text: '#1d4ed8', lightBg: '#dbeafe', border: '#60a5fa' },
  'filles': { bg: '#7c3aed', text: '#6d28d9', lightBg: '#ede9fe', border: '#a78bfa' },
  'garcons': { bg: '#0284c7', text: '#0369a1', lightBg: '#e0f2fe', border: '#38bdf8' },
  'petits-fils-et-filles': { bg: '#ea580c', text: '#c2410c', lightBg: '#ffedd5', border: '#fb923c' },
};

export default function ChatRoom() {
  const router = useRouter();
  const [currentSalonKey, setCurrentSalonKey] = useState<string>('general');

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [fullName, setFullName] = useState('');
  const [allowedSalons, setAllowedSalons] = useState<string[]>(['general', 'photos-familiales']);
  const [allSalons, setAllSalons] = useState<string[]>(DEFAULT_SALONS.map(s => s.id));
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [activeCallType, setActiveCallType] = useState<'audio' | 'video' | null>(null);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'passwords' | 'salons' | 'en_ligne' | 'moderation' | 'annonces'>('users');
  const [adminUsers, setAdminUsers] = useState<UserRecord[]>([]);
  const [adminMessages, setAdminMessages] = useState<Message[]>([]);
  const [newSalonName, setNewSalonName] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ADMIN_NAME = "Eric MABOM";
  const isAdmin = fullName.toLowerCase() === ADMIN_NAME.toLowerCase();

  const getSalonLabel = (sId: string) => {
    const found = DEFAULT_SALONS.find(s => s.id === sId);
    if (found) return found.label;
    return sId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  useEffect(() => {
    const user = localStorage.getItem('chat_user');
    if (!user) {
      router.push('/');
      return;
    }
    setFullName(user);

    const initProfile = async () => {
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) {
        setAdminUsers(usersData);
        
        const dynamicSalons = new Set(DEFAULT_SALONS.map(s => s.id));
        usersData.forEach(u => u.salons?.forEach((s: string) => dynamicSalons.add(s)));
        const salonList = Array.from(dynamicSalons);
        setAllSalons(salonList);

        if (user.toLowerCase() === ADMIN_NAME.toLowerCase()) {
          setAllowedSalons(salonList);
        } else {
          const uRecord = usersData.find(u => u.full_name.toLowerCase() === user.toLowerCase());
          if (uRecord) {
            if (uRecord.status !== 'valide') {
              router.push('/');
              return;
            }
            const userSalons = uRecord.salons && uRecord.salons.length > 0 
              ? Array.from(new Set(['general', 'photos-familiales', ...uRecord.salons]))
              : ['general', 'photos-familiales'];

            setAllowedSalons(userSalons);
          }
        }
      }
    };

    initProfile();

    const presenceChannel = supabase.channel('nkeuya_presence', {
      config: { presence: { key: user } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(Object.keys(state));
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

  useEffect(() => {
    if (!currentSalonKey) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('salon', currentSalonKey)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 50);
      } else {
        setMessages([]);
      }
    };

    fetchMessages();

    const roomChannel = supabase
      .channel(`room-${currentSalonKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT' && (payload.new as Message).salon === currentSalonKey) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === (payload.new as Message).id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [currentSalonKey]);

  useEffect(() => {
    if (showAdminPanel && isAdmin) {
      fetchAdminData();
    }
  }, [showAdminPanel, isAdmin]);

  const fetchAdminData = async () => {
    const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (usersData) setAdminUsers(usersData);
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(40);
    if (msgData) setAdminMessages(msgData);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchAdminData();
    setIsRefreshing(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !fullName) return;

    const contentToSend = newMessage.trim();
    setNewMessage('');

    try {
      const { data, error } = await supabase.from('messages').insert({
        content: contentToSend,
        username: fullName,
        salon: currentSalonKey,
      }).select();

      if (error) {
        alert("Erreur Supabase : " + error.message);
        return;
      }

      if (data && data.length > 0) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data[0].id);
          if (exists) return prev;
          return [...prev, data[0] as Message];
        });
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } catch (err: any) {
      alert("Erreur réseau : " + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fullName) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${currentSalonKey}/${fileName}`;

    let fileType: 'audio' | 'video' | 'document' = 'document';
    if (file.type.startsWith('audio/')) fileType = 'audio';
    else if (file.type.startsWith('video/')) fileType = 'video';

    const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);

    if (uploadError) {
      alert("Erreur lors de l'envoi du fichier : " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('chat_media').getPublicUrl(filePath);
    const fileUrl = publicUrlData.publicUrl;

    const { data, error } = await supabase.from('messages').insert({
      content: `📁 Fichier partagé : ${file.name}`,
      username: fullName,
      salon: currentSalonKey,
      file_url: fileUrl,
      file_type: fileType,
    }).select();

    if (error) {
      alert("Erreur d'enregistrement du fichier : " + error.message);
    } else if (data && data.length > 0) {
      setMessages((prev) => [...prev, data[0] as Message]);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_user');
    router.push('/');
  };

  const updateUserStatus = async (userId: string, status: 'valide' | 'refuse' | 'en_attente') => {
    const updatePayload: any = { status };
    if (status === 'valide') {
      updatePayload.salons = ['general', 'photos-familiales'];
    }

    await supabase.from('users').update(updatePayload).eq('id', userId);
    setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updatePayload } : u)));
  };

  const deleteUserAccount = async (user: UserRecord) => {
    if (!confirm(`⚠️ Supprimer le compte de "${user.full_name}" ?`)) return;
    await supabase.from('users').delete().eq('id', user.id);
    setAdminUsers((prev) => prev.filter((u) => u.id !== user.id));
  };

  const handleSavePasswordFromUsersTab = async (userId: string, userName: string) => {
    if (!newPasswordInput.trim()) return;
    const cleanPassword = newPasswordInput.trim();
    await supabase.from('users').update({ password: cleanPassword }).eq('id', userId);
    setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, password: cleanPassword } : u)));
    setEditingPasswordUserId(null);
    setNewPasswordInput('');
    alert(`Mot de passe réinitialisé pour ${userName} !`);
  };

  const handleSavePassword = async (userId: string, userName: string) => {
    if (!newPasswordInput.trim()) return;
    const cleanPassword = newPasswordInput.trim();
    await supabase.from('users').update({ password: cleanPassword }).eq('id', userId);
    setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, password: cleanPassword } : u)));
    setEditingPasswordUserId(null);
    setNewPasswordInput('');
    alert(`Mot de passe mis à jour pour ${userName} !`);
  };

  const toggleSalonUser = async (user: UserRecord, salonId: string) => {
    const currentSalons = Array.isArray(user.salons) ? user.salons : ['general', 'photos-familiales'];
    const updatedSalons = currentSalons.includes(salonId)
      ? currentSalons.filter((s) => s !== salonId)
      : [...currentSalons, salonId];

    const { error } = await supabase.from('users').update({ salons: updatedSalons }).eq('id', user.id);
    if (!error) {
      setAdminUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, salons: updatedSalons } : u)));
    }
  };

  const handleAddSalon = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedId = newSalonName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!formattedId || allSalons.includes(formattedId)) return;

    const updatedSalons = Array.from(new Set([...allSalons, formattedId]));
    setAllSalons(updatedSalons);
    setNewSalonName('');
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('messages').delete().eq('id', msgId);
    setAdminMessages((prev) => prev.filter((m) => m.id !== msgId));
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const purgeSalon = async (targetSalon: string) => {
    if (!confirm(`⚠️ Purger les messages de ${getSalonLabel(targetSalon)} ?`)) return;
    await supabase.from('messages').delete().eq('salon', targetSalon);
    if (targetSalon === currentSalonKey) setMessages([]);
    fetchAdminData();
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    await supabase.from('messages').insert({
      content: `📢 ANNONCE ADMIN : ${announcementText.trim()}`,
      username: '📢 Eric MABOM (ADMIN)',
      salon: currentSalonKey,
    });
    setAnnouncementText('');
    setShowAdminPanel(false);
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[#111b21] p-0 md:p-4 overflow-hidden">
      
      {/* CADRE SMARTPHONE */}
      <div className="flex flex-col h-full w-full md:h-[90vh] md:w-[440px] md:rounded-[40px] md:border-[8px] md:border-[#1e293b] bg-[#efeae2] relative overflow-hidden shadow-2xl">
        
        {/* EN-TÊTE AVEC LOGO BLEU */}
        <div className="bg-[#1e3a8a] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-blue-400 flex items-center justify-center font-bold text-white shadow-md">
                {fullName ? fullName.charAt(0).toUpperCase() : 'N'}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-current rounded-full"></span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-wide">{fullName || 'Utilisateur'}</h2>
              <div className="text-[11px] text-blue-200 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
                <span>{getSalonLabel(currentSalonKey)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCallType('audio')}
              className="p-2 bg-blue-900/50 hover:bg-blue-800 rounded-full transition text-white shadow cursor-pointer"
              title="Appel audio"
            >
              📞
            </button>
            <button
              onClick={() => setActiveCallType('video')}
              className="p-2 bg-blue-900/50 hover:bg-blue-800 rounded-full transition text-white shadow cursor-pointer"
              title="Appel vidéo"
            >
              📹
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition shadow cursor-pointer ${
                  showAdminPanel ? 'bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-gray-900'
                }`}
              >
                {showAdminPanel ? '💬 Chat' : '⚙️ Admin'}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-xs bg-black/30 hover:bg-black/50 text-white px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              Quitter
            </button>
          </div>
        </div>

        {/* Modal d'appel 100% Gratuit et Fonctionnel (Jitsi Meet Intégré) */}
        {activeCallType && (
          <div className="absolute inset-0 bg-black/90 z-50 flex flex-col">
            <div className="bg-[#1e3a8a] text-white p-3 flex justify-between items-center shrink-0">
              <span className="font-bold text-xs">
                {activeCallType === 'video' ? '📹 Appel Vidéo' : '📞 Appel Audio'} - {getSalonLabel(currentSalonKey)}
              </span>
              <button
                onClick={() => setActiveCallType(null)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-full font-bold cursor-pointer shadow"
              >
                Raccrocher ❌
              </button>
            </div>
            <div className="flex-1 w-full h-full bg-black relative">
              <iframe
                src={`https://meet.jit.si/NkeuyaTchat_${currentSalonKey}#userInfo.displayName="${encodeURIComponent(fullName)}"&config.startWithAudioMuted=false&config.startWithVideoMuted=${activeCallType === 'audio' ? 'true' : 'false'}`}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}

        {/* PANNEAU ADMIN */}
        {isAdmin && showAdminPanel ? (
          <div className="flex-1 bg-[#111b21] text-white overflow-y-auto flex flex-col">
            <div className="bg-[#1e3a8a] p-2 flex items-center justify-between border-b border-blue-900 overflow-x-auto shrink-0 gap-2">
              <div className="flex gap-1 overflow-x-auto flex-1">
                {[
                  { id: 'users', label: '👥 Membres' },
                  { id: 'passwords', label: '🔑 Mots de passe' },
                  { id: 'salons', label: '💬 Salons' },
                  { id: 'en_ligne', label: `🟢 En ligne` },
                  { id: 'moderation', label: '🛡️ Modération' },
                  { id: 'annonces', label: '📢 Annonce' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id as any)}
                    className={`text-xs px-2.5 py-2 rounded-lg font-semibold transition shrink-0 cursor-pointer ${
                      adminTab === tab.id ? 'bg-blue-600 text-white shadow' : 'bg-[#111b21] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="bg-blue-700 hover:bg-blue-800 text-white p-2 rounded-lg font-bold shrink-0 transition flex items-center gap-1 shadow cursor-pointer disabled:opacity-50 text-xs"
                title="Rafraîchir"
              >
                <span>{isRefreshing ? '⏳' : '🔄'}</span>
              </button>
            </div>

            <div className="p-4 flex-1 space-y-4">
              {adminTab === 'users' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-blue-400 uppercase">Gestion des Membres et Validations</h3>
                  </div>
                  {adminUsers.map((u) => (
                    <div key={u.id} className="bg-[#1e293b] p-3.5 rounded-xl border border-blue-900 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="font-bold text-sm text-gray-100">{u.full_name}</span>
                          <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            u.status === 'valide' ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' :
                            u.status === 'refuse' ? 'bg-red-900 text-red-300 border border-red-700' :
                            'bg-amber-900 text-amber-300 border border-amber-700'
                          }`}>
                            {u.status || 'en_attente'}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteUserAccount(u)}
                          className="text-[10px] bg-red-950 text-red-300 px-2 py-1 rounded-lg border border-red-800 font-bold cursor-pointer"
                        >
                          🗑️ Suppr.
                        </button>
                      </div>

                      {/* Salons autorisés */}
                      <div className="bg-[#111b21] p-2.5 rounded-lg border border-blue-900 space-y-1.5">
                        <span className="text-[10px] font-bold text-blue-400 uppercase">Salons autorisés :</span>
                        <div className="flex flex-wrap gap-1.5">
                          {allSalons.map((sId) => {
                            const userSalonsArr = Array.isArray(u.salons) ? u.salons : [];
                            const hasAccess = userSalonsArr.includes(sId) || sId === 'general' || sId === 'photos-familiales';
                            return (
                              <button
                                key={sId}
                                onClick={() => toggleSalonUser(u, sId)}
                                className={`text-[10px] px-2 py-1 rounded-md border transition font-medium flex items-center gap-1 cursor-pointer ${
                                  hasAccess ? 'bg-blue-600 text-white border-blue-400' : 'bg-[#1e293b] text-gray-400 border-gray-700'
                                }`}
                              >
                                <span>{hasAccess ? '✓' : '+'}</span>
                                <span>{getSalonLabel(sId)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section Réinitialisation mot de passe directement dans Membres */}
                      <div className="bg-[#111b21] p-2.5 rounded-lg border border-blue-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">Mot de passe :</span>
                          <button
                            onClick={() => { setEditingPasswordUserId(editingPasswordUserId === u.id ? null : u.id); setNewPasswordInput(''); }}
                            className="text-[10px] bg-blue-700 text-white px-2 py-1 rounded font-semibold cursor-pointer"
                          >
                            {editingPasswordUserId === u.id ? 'Annuler' : '🔑 Réinitialiser MDP'}
                          </button>
                        </div>
                        {editingPasswordUserId === u.id && (
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={newPasswordInput}
                              onChange={(e) => setNewPasswordInput(e.target.value)}
                              placeholder="Nouveau mot de passe"
                              className="flex-1 bg-[#1e293b] border border-blue-800 rounded px-2 py-1 text-xs text-white"
                            />
                            <button
                              onClick={() => handleSavePasswordFromUsersTab(u.id, u.full_name)}
                              className="bg-emerald-600 text-white text-[10px] px-3 py-1 rounded font-bold cursor-pointer"
                            >
                              Enregistrer
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Boutons d'action : Validation, Refus, Remise en attente */}
                      <div className="flex justify-between items-center pt-2 border-t border-blue-900 flex-wrap gap-2">
                        <button
                          onClick={() => updateUserStatus(u.id, 'en_attente')}
                          className="text-[10px] bg-gray-800 hover:bg-gray-700 text-amber-300 px-2.5 py-1 rounded border border-amber-900/50 cursor-pointer"
                        >
                          🔄 Remettre en attente
                        </button>

                        <div className="flex gap-1.5">
                          {u.status !== 'valide' && (
                            <button
                              onClick={() => updateUserStatus(u.id, 'valide')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-3 py-1.5 rounded font-bold cursor-pointer shadow"
                            >
                              ✅ Valider l'inscription
                            </button>
                          )}
                          {u.status !== 'refuse' && (
                            <button
                              onClick={() => updateUserStatus(u.id, 'refuse')}
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-3 py-1.5 rounded font-bold cursor-pointer shadow"
                            >
                              ❌ Bloquer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'passwords' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase">Gestion des Mots de passe</h3>
                  {adminUsers.map((u) => (
                    <div key={u.id} className="bg-[#1e293b] p-3.5 rounded-xl border border-blue-900 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-100">{u.full_name}</span>
                        <button
                          onClick={() => { setEditingPasswordUserId(editingPasswordUserId === u.id ? null : u.id); setNewPasswordInput(''); }}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          {editingPasswordUserId === u.id ? 'Annuler' : '🔑 Modifier'}
                        </button>
                      </div>
                      {editingPasswordUserId === u.id && (
                        <div className="pt-2 border-t border-blue-900 flex gap-2">
                          <input
                            type="text"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Nouveau mot de passe"
                            className="flex-1 bg-[#111b21] border border-blue-800 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                          <button onClick={() => handleSavePassword(u.id, u.full_name)} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer">OK</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'salons' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddSalon} className="bg-[#1e293b] p-4 rounded-xl border border-blue-900 space-y-3">
                    <h4 className="text-xs font-bold text-blue-400 uppercase">➕ Créer un salon</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSalonName}
                        onChange={(e) => setNewSalonName(e.target.value)}
                        placeholder="Nom..."
                        required
                        className="flex-1 bg-[#111b21] border border-blue-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                      <button type="submit" className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-bold cursor-pointer">Ajouter</button>
                    </div>
                  </form>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-blue-400 uppercase">Salons Actifs</h4>
                    {allSalons.map((sId) => (
                      <div key={sId} className="bg-[#1e293b] p-3 rounded-lg border border-blue-900 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-200">{getSalonLabel(sId)}</span>
                        {sId !== 'general' && sId !== 'photos-familiales' && (
                          <button onClick={() => purgeSalon(sId)} className="bg-red-950 text-red-400 text-[10px] px-2 py-1 rounded cursor-pointer">🗑️ Purger</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'en_ligne' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase">Membres connectés ({onlineUsers.length})</h3>
                  {onlineUsers.map((name, index) => (
                    <div key={index} className="bg-[#1e293b] p-3 rounded-lg border border-blue-900 text-xs font-bold">{name}</div>
                  ))}
                </div>
              )}

              {adminTab === 'moderation' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase">Modération</h3>
                  {adminMessages.map((msg) => (
                    <div key={msg.id} className="bg-[#1e293b] p-3 rounded-lg border border-blue-900 flex justify-between items-center gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-blue-400">{msg.username}</span>
                        <p className="text-xs text-gray-200 truncate">{msg.content}</p>
                      </div>
                      <button onClick={() => deleteMessage(msg.id)} className="bg-red-600 text-white text-[10px] px-2.5 py-1.5 rounded cursor-pointer">Supprimer</button>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'annonces' && (
                <form onSubmit={handleSendAnnouncement} className="bg-[#1e293b] p-4 rounded-xl border border-blue-900 space-y-3">
                  <h3 className="text-xs font-bold text-blue-400 uppercase">Annonce officielle</h3>
                  <textarea
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Message..."
                    rows={4}
                    className="w-full bg-[#111b21] border border-blue-800 rounded-lg p-3 text-xs text-white"
                  />
                  <button type="submit" className="w-full bg-amber-500 text-gray-900 font-bold py-2.5 rounded-lg text-xs cursor-pointer">Publier</button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* BARRE DE NAVIGATION DES SALONS (SANS BARRE DE DÉFILEMENT) */}
            <div className="bg-[#f0f2f5] px-3 py-2.5 flex gap-2 overflow-x-auto border-b border-gray-300 text-xs shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              {allSalons.map((sId) => {
                const hasAccess = isAdmin || allowedSalons.includes(sId) || sId === 'general' || sId === 'photos-familiales';
                if (!hasAccess) return null;

                const isActive = currentSalonKey === sId;
                const salonTheme = SALON_COLORS[sId] || { bg: '#2563eb', text: '#1d4ed8', lightBg: '#dbeafe', border: '#60a5fa' };

                return (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => setCurrentSalonKey(sId)}
                    style={
                      isActive
                        ? { backgroundColor: '#1e3a8a', color: '#ffffff', borderColor: '#1e3a8a' }
                        : { backgroundColor: salonTheme.lightBg, color: salonTheme.text, borderColor: salonTheme.border }
                    }
                    className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all duration-200 border cursor-pointer ${
                      isActive ? 'shadow-md scale-105 font-bold' : 'hover:opacity-85'
                    }`}
                  >
                    {getSalonLabel(sId)}
                  </button>
                );
              })}
            </div>

            {/* FIL DES MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
              {messages.map((msg) => {
                const authorName = msg.username || msg.sender || 'Inconnu';
                const isAnnouncement = String(authorName).includes('ADMIN');

                return (
                  <div key={msg.id} className="flex flex-col items-start">
                    <div className={`max-w-[85%] rounded-lg rounded-tl-none px-3.5 py-2 text-sm shadow-sm relative ${
                      isAnnouncement ? 'bg-amber-100 border-2 border-amber-400 text-amber-950 font-medium' : 'bg-white text-gray-900'
                    }`}>
                      <span className="block text-[11px] font-bold mb-0.5 text-blue-700">{authorName}</span>

                      <p className="break-words leading-relaxed">{msg.content}</p>

                      {msg.file_url && msg.file_type === 'audio' && (
                        <audio controls className="mt-2 w-full max-w-xs">
                          <source src={msg.file_url} type="audio/mpeg" />
                        </audio>
                      )}

                      {msg.file_url && msg.file_type === 'video' && (
                        <video controls className="mt-2 rounded-lg max-h-48 w-full object-cover">
                          <source src={msg.file_url} type="video/mp4" />
                        </video>
                      )}

                      {msg.file_url && msg.file_type === 'document' && (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs text-blue-600 underline font-bold"
                        >
                          Télécharger le document
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* ZONE DE SAISIE ET PIÈCES JOINTES */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[#f0f2f5] flex items-center gap-2 shrink-0 border-t border-gray-300">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,audio/*,video/*,application/pdf"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 transition cursor-pointer text-sm"
                title="Joindre un fichier"
              >
                {uploading ? '⏳' : '📎'}
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Tapez un message..."
                className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm border border-gray-300 focus:outline-none focus:border-blue-500 text-gray-900"
              />
              <button
                type="submit"
                className="bg-[#1e3a8a] text-white p-2.5 rounded-full hover:bg-blue-900 transition cursor-pointer shadow"
              >
                ➤
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
