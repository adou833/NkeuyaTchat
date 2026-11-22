'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  content: string;
  username: string;
  sender?: string;
  salon_id: string;
  file_url?: string;
  file_type?: 'image' | 'audio' | 'video' | 'document';
  created_at: string;
}

interface UserRecord {
  id: string;
  full_name: string;
  status: string;
  salons?: string[];
  allowed_salons?: string[];
  password?: string;
}

interface ChatRoomProps {
  salonId: string;
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

const SALON_COLORS: Record<string, { bg: string; text: string; lightBg: string; border: string }> = {
  general: { bg: '#005c4b', text: '#005c4b', lightBg: '#e6f4f1', border: '#005c4b' },
  'photos-familiales': { bg: '#d97706', text: '#b45309', lightBg: '#fef3c7', border: '#f59e0b' },
  femmes: { bg: '#db2777', text: '#be185d', lightBg: '#fce7f3', border: '#f472b6' },
  hommes: { bg: '#2563eb', text: '#1d4ed8', lightBg: '#dbeafe', border: '#60a5fa' },
  filles: { bg: '#7c3aed', text: '#6d28d9', lightBg: '#ede9fe', border: '#a78bfa' },
  garcons: { bg: '#0284c7', text: '#0369a1', lightBg: '#e0f2fe', border: '#38bdf8' },
  'petits-fils-et-filles': { bg: '#ea580c', text: '#c2410c', lightBg: '#ffedd5', border: '#fb923c' },
};

const ADMIN_NAME = 'Eric MABOM';

function normalizeSalonId(rawId: string): string {
  try {
    return decodeURIComponent(rawId) || 'general';
  } catch {
    return rawId || 'general';
  }
}

export default function ChatRoom({ salonId }: ChatRoomProps) {
  const router = useRouter();
  const decodedSalonId = normalizeSalonId(salonId);

  const [selectedSalonOverride, setSelectedSalonOverride] = useState<string | null>(null);
  const currentSalonKey = selectedSalonOverride ?? decodedSalonId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [fullName, setFullName] = useState('');
  const [allowedSalons, setAllowedSalons] = useState<string[]>(
    DEFAULT_SALONS.map((s) => s.id)
  );
  const [allSalons, setAllSalons] = useState<string[]>(
    DEFAULT_SALONS.map((s) => s.id)
  );
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [activeCall, setActiveCall] = useState<'audio' | 'video' | null>(null);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<
    'users' | 'passwords' | 'salons' | 'en_ligne' | 'moderation' | 'annonces'
  >('users');
  const [adminUsers, setAdminUsers] = useState<UserRecord[]>([]);
  const [adminMessages, setAdminMessages] = useState<Message[]>([]);
  const [newSalonName, setNewSalonName] = useState('');
  const [announcementText, setAnnouncementText] = useState('');

  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = fullName.toLowerCase() === ADMIN_NAME.toLowerCase();

  const getSalonLabel = (sId: string) => {
    const found = DEFAULT_SALONS.find((s) => s.id === sId);
    if (found) return found.label;
    return sId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getUserSalons = (u: UserRecord): string[] => {
    if (Array.isArray(u.salons) && u.salons.length > 0) return u.salons;
    if (Array.isArray(u.allowed_salons) && u.allowed_salons.length > 0) {
      return u.allowed_salons;
    }
    return DEFAULT_SALONS.map((s) => s.id);
  };

  const handleSelectSalon = (targetSalonId: string) => {
    setSelectedSalonOverride(targetSalonId);
    setShowAdminPanel(false);
    router.replace(`/salon/${encodeURIComponent(targetSalonId)}`);
  };

  useEffect(() => {
    const user =
      typeof window !== 'undefined' ? window.localStorage.getItem('chat_user') : null;

    if (!user) {
      router.push('/');
      return;
    }

    let cancelled = false;

    const initProfile = async () => {
      try {
        const { data: usersData } = await supabase.from('users').select('*');
        if (cancelled) return;

        setFullName(user);

        if (usersData) {
          setAdminUsers(usersData);

          const dynamicSalons = new Set(DEFAULT_SALONS.map((s) => s.id));
          usersData.forEach((u: UserRecord) => {
            getUserSalons(u).forEach((s: string) => dynamicSalons.add(s));
          });
          const salonList = Array.from(dynamicSalons);
          setAllSalons(salonList);

          if (user.toLowerCase() === ADMIN_NAME.toLowerCase()) {
            setAllowedSalons(salonList);
          } else {
            const uRecord = usersData.find(
              (u: UserRecord) => u.full_name?.toLowerCase() === user.toLowerCase()
            );
            if (uRecord) {
              const isApproved =
                uRecord.status === 'valide' || uRecord.status === 'approved';
              if (!isApproved) {
                router.push('/');
                return;
              }
              const recordSalons = getUserSalons(uRecord);
              setAllowedSalons(recordSalons.length > 0 ? recordSalons : salonList);
            } else {
              setAllowedSalons(salonList);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
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
      cancelled = true;
      supabase.removeChannel(presenceChannel);
    };
  }, [router]);

  useEffect(() => {
    if (!currentSalonKey || isLoadingProfile) return;

    let cancelled = false;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('salon_id', currentSalonKey)
        .order('created_at', { ascending: true });

      if (cancelled) return;

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
          if (
            payload.eventType === 'INSERT' &&
            (payload.new as Message).salon_id === currentSalonKey
          ) {
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
      cancelled = true;
      supabase.removeChannel(roomChannel);
    };
  }, [currentSalonKey, isLoadingProfile]);

  const fetchAdminData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (showAdminPanel && isAdmin) {
      void fetchAdminData();
    }
  }, [showAdminPanel, isAdmin, fetchAdminData]);

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
    setStatusFeedback(null);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        content: contentToSend,
        username: fullName,
        sender: fullName,
        salon_id: currentSalonKey,
      })
      .select();

    if (error) {
      setStatusFeedback("Erreur d'envoi du message : " + error.message);
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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fullName) return;

    setUploading(true);
    setStatusFeedback(null);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${currentSalonKey}/${fileName}`;

    let fileType: 'audio' | 'video' | 'document' = 'document';
    if (file.type.startsWith('audio/')) fileType = 'audio';
    else if (file.type.startsWith('video/')) fileType = 'video';

    const { error: uploadError } = await supabase.storage
      .from('chat_media')
      .upload(filePath, file);

    if (uploadError) {
      setStatusFeedback("Erreur lors de l'envoi du fichier : " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat_media')
      .getPublicUrl(filePath);
    const fileUrl = publicUrlData.publicUrl;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        content: `Fichier partagé : ${file.name}`,
        username: fullName,
        sender: fullName,
        salon_id: currentSalonKey,
        file_url: fileUrl,
        file_type: fileType,
      })
      .select();

    if (error) {
      setStatusFeedback("Erreur d'enregistrement du fichier : " + error.message);
    } else if (data && data.length > 0) {
      setMessages((prev) => [...prev, data[0] as Message]);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('chat_user');
    }
    router.push('/');
  };

  const updateUserStatus = async (userId: string, status: 'valide' | 'refuse') => {
    const updatePayload: { status: string; salons?: string[] } = { status };
    if (status === 'valide') {
      updatePayload.salons = DEFAULT_SALONS.map((s) => s.id);
    }

    await supabase.from('users').update(updatePayload).eq('id', userId);
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updatePayload } : u))
    );
  };

  const deleteUserAccount = async (user: UserRecord) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Supprimer le compte de "${user.full_name}" ?`)
    ) {
      return;
    }
    await supabase.from('users').delete().eq('id', user.id);
    setAdminUsers((prev) => prev.filter((u) => u.id !== user.id));
  };

  const forceResetUser = async (user: UserRecord) => {
    await supabase.from('users').update({ status: 'en_attente' }).eq('id', user.id);
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: 'en_attente' } : u))
    );
  };

  const handleSavePassword = async (userId: string, userName: string) => {
    if (!newPasswordInput.trim()) return;
    const cleanPassword = newPasswordInput.trim();
    await supabase.from('users').update({ password: cleanPassword }).eq('id', userId);
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, password: cleanPassword } : u))
    );
    setEditingPasswordUserId(null);
    setNewPasswordInput('');
    setStatusFeedback(`Mot de passe mis à jour pour ${userName}.`);
  };

  const toggleSalonUser = async (user: UserRecord, salon: string) => {
    const currentSalons = getUserSalons(user);
    const updatedSalons = currentSalons.includes(salon)
      ? currentSalons.filter((s) => s !== salon)
      : [...currentSalons, salon];

    const { error } = await supabase
      .from('users')
      .update({ salons: updatedSalons })
      .eq('id', user.id);
    if (!error) {
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, salons: updatedSalons } : u))
      );
    }
  };

  const handleAddSalon = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedId = newSalonName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
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
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Purger les messages de ${getSalonLabel(targetSalon)} ?`)
    ) {
      return;
    }
    await supabase.from('messages').delete().eq('salon_id', targetSalon);
    if (targetSalon === currentSalonKey) setMessages([]);
    void fetchAdminData();
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    await supabase.from('messages').insert({
      content: `ANNONCE ADMIN : ${announcementText.trim()}`,
      username: 'Eric MABOM (ADMIN)',
      sender: 'Eric MABOM (ADMIN)',
      salon_id: currentSalonKey,
    });
    setAnnouncementText('');
    setShowAdminPanel(false);
  };

  if (isLoadingProfile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#111b21] text-sm font-bold text-[#2563eb]">
        Chargement du salon NkeuyaTchat...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[#111b21] p-0 md:p-4">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#efeae2] shadow-2xl md:h-[90vh] md:w-[440px] md:rounded-[40px] md:border-[8px] md:border-[#1e293b]">
        <div className="z-10 flex shrink-0 items-center justify-between bg-[#1e3a8a] px-4 py-3 text-white shadow-md">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-400 bg-blue-600 font-bold text-white shadow-md">
                {fullName ? fullName.charAt(0).toUpperCase() : 'N'}
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-current bg-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-white">{fullName}</h2>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-200">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
                <span>{getSalonLabel(currentSalonKey)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCall('audio')}
              className="cursor-pointer rounded-full bg-blue-900/50 p-2 text-xs text-white shadow transition hover:bg-blue-800"
              title="Appel audio"
            >
              Audio
            </button>
            <button
              type="button"
              onClick={() => setActiveCall('video')}
              className="cursor-pointer rounded-full bg-blue-900/50 p-2 text-xs text-white shadow transition hover:bg-blue-800"
              title="Appel vidéo"
            >
              Vidéo
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold shadow transition ${
                  showAdminPanel
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-500 text-gray-900 hover:bg-amber-600'
                }`}
              >
                {showAdminPanel ? 'Chat' : 'Admin'}
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer rounded-lg bg-black/30 px-2.5 py-1.5 text-xs text-white transition hover:bg-black/50"
            >
              Quitter
            </button>
          </div>
        </div>

        {statusFeedback && (
          <div className="border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-xs font-medium text-amber-900">
            {statusFeedback}
          </div>
        )}

        {activeCall && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 text-white">
            <div className="flex w-full max-w-md flex-col items-center space-y-4 rounded-2xl border border-blue-600 bg-[#1e293b] p-6 shadow-2xl">
              <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-blue-600 text-xl font-bold shadow-lg">
                {activeCall === 'video' ? 'VIDÉO' : 'AUDIO'}
              </div>
              <h3 className="text-lg font-bold">
                {activeCall === 'video'
                  ? 'Appel Vidéo en cours...'
                  : 'Appel Audio en cours...'}
              </h3>
              <p className="text-center text-xs text-blue-300">
                Salon {getSalonLabel(currentSalonKey)} - Famille Nkeuya
              </p>
              <button
                type="button"
                onClick={() => setActiveCall(null)}
                className="cursor-pointer rounded-full bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow transition hover:bg-red-700"
              >
                Raccrocher
              </button>
            </div>
          </div>
        )}

        {isAdmin && showAdminPanel ? (
          <div className="flex flex-1 flex-col overflow-y-auto bg-[#111b21] text-white">
            <div className="flex shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-blue-900 bg-[#1e293b] p-2">
              <div className="flex flex-1 gap-1 overflow-x-auto">
                {[
                  { id: 'users', label: 'Membres' },
                  { id: 'passwords', label: 'Mots de passe' },
                  { id: 'salons', label: 'Salons' },
                  { id: 'en_ligne', label: `En ligne (${onlineUsers.length})` },
                  { id: 'moderation', label: 'Modération' },
                  { id: 'annonces', label: 'Annonce' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdminTab(tab.id as typeof adminTab)}
                    className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                      adminTab === tab.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-[#111b21] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-blue-700 p-2 text-xs font-bold text-white shadow transition hover:bg-blue-800 disabled:opacity-50"
                title="Rafraîchir"
              >
                <span>{isRefreshing ? '...' : 'Actualiser'}</span>
              </button>
            </div>

            <div className="flex-1 space-y-4 p-4">
              {adminTab === 'users' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-blue-400">
                    Gestion des Membres et Droits
                  </h3>
                  {adminUsers.map((u) => (
                    <div
                      key={u.id}
                      className="space-y-3 rounded-xl border border-blue-900 bg-[#1e293b] p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-gray-100">
                            {u.full_name}
                          </span>
                          <span className="ml-2 text-[10px] text-blue-300">
                            ({u.status})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteUserAccount(u)}
                          className="cursor-pointer rounded-lg border border-red-800 bg-red-950 px-2 py-1 text-[10px] font-bold text-red-300"
                        >
                          Suppr.
                        </button>
                      </div>

                      <div className="space-y-1.5 rounded-lg border border-blue-900 bg-[#111b21] p-2.5">
                        <span className="text-[10px] font-bold uppercase text-blue-400">
                          Salons autorisés :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {allSalons.map((sId) => {
                            const hasAccess = getUserSalons(u).includes(sId);
                            return (
                              <button
                                key={sId}
                                type="button"
                                onClick={() => toggleSalonUser(u, sId)}
                                className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition ${
                                  hasAccess
                                    ? 'border-blue-400 bg-blue-600 text-white'
                                    : 'border-gray-700 bg-[#1e293b] text-gray-400'
                                }`}
                              >
                                <span>{hasAccess ? '✓' : '+'}</span>
                                <span>{getSalonLabel(sId)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-blue-900 pt-2">
                        <button
                          type="button"
                          onClick={() => forceResetUser(u)}
                          className="cursor-pointer text-[10px] text-amber-300"
                        >
                          En attente
                        </button>
                        <div className="flex gap-1.5">
                          {u.status !== 'valide' && u.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => updateUserStatus(u.id, 'valide')}
                              className="cursor-pointer rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white"
                            >
                              Valider
                            </button>
                          )}
                          {u.status !== 'refuse' && (
                            <button
                              type="button"
                              onClick={() => updateUserStatus(u.id, 'refuse')}
                              className="cursor-pointer rounded bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white"
                            >
                              Bloquer
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
                  <h3 className="text-xs font-semibold uppercase text-blue-400">
                    Mots de passe
                  </h3>
                  {adminUsers.map((u) => (
                    <div
                      key={u.id}
                      className="space-y-3 rounded-xl border border-blue-900 bg-[#1e293b] p-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-100">
                          {u.full_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPasswordUserId(
                              editingPasswordUserId === u.id ? null : u.id
                            );
                            setNewPasswordInput('');
                          }}
                          className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white"
                        >
                          {editingPasswordUserId === u.id ? 'Annuler' : 'Modifier'}
                        </button>
                      </div>
                      {editingPasswordUserId === u.id && (
                        <div className="flex gap-2 border-t border-blue-900 pt-2">
                          <input
                            type="text"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Nouveau mot de passe"
                            className="flex-1 rounded-lg border border-blue-800 bg-[#111b21] px-3 py-1.5 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePassword(u.id, u.full_name)}
                            className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'salons' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleAddSalon}
                    className="space-y-3 rounded-xl border border-blue-900 bg-[#1e293b] p-4"
                  >
                    <h4 className="text-xs font-bold uppercase text-blue-400">
                      Créer un salon
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSalonName}
                        onChange={(e) => setNewSalonName(e.target.value)}
                        placeholder="Nom du salon..."
                        required
                        className="flex-1 rounded-lg border border-blue-800 bg-[#111b21] px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                      >
                        Ajouter
                      </button>
                    </div>
                  </form>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-blue-400">
                      Salons Actifs
                    </h4>
                    {allSalons.map((sId) => (
                      <div
                        key={sId}
                        className="flex items-center justify-between rounded-lg border border-blue-900 bg-[#1e293b] p-3"
                      >
                        <span className="text-xs font-bold text-gray-200">
                          {getSalonLabel(sId)}
                        </span>
                        {sId !== 'general' && sId !== 'photos-familiales' && (
                          <button
                            type="button"
                            onClick={() => purgeSalon(sId)}
                            className="cursor-pointer rounded bg-red-950 px-2 py-1 text-[10px] text-red-400"
                          >
                            Purger
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'en_ligne' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-blue-400">
                    Membres connectés ({onlineUsers.length})
                  </h3>
                  {onlineUsers.map((name, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-blue-900 bg-[#1e293b] p-3 text-xs font-bold"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'moderation' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-blue-400">
                    Modération
                  </h3>
                  {adminMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-blue-900 bg-[#1e293b] p-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-blue-400">
                          {msg.username}
                        </span>
                        <p className="truncate text-xs text-gray-200">{msg.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteMessage(msg.id)}
                        className="shrink-0 cursor-pointer rounded bg-red-600 px-2.5 py-1.5 text-[10px] text-white"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'annonces' && (
                <form
                  onSubmit={handleSendAnnouncement}
                  className="space-y-3 rounded-xl border border-blue-900 bg-[#1e293b] p-4"
                >
                  <h3 className="text-xs font-bold uppercase text-blue-400">
                    Annonce officielle
                  </h3>
                  <textarea
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Message..."
                    rows={4}
                    className="w-full rounded-lg border border-blue-800 bg-[#111b21] p-3 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full cursor-pointer rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-gray-900"
                  >
                    Publier
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-gray-300 bg-[#f0f2f5] px-3 py-2.5 text-xs">
              {allSalons.map((sId) => {
                const hasAccess = isAdmin || allowedSalons.includes(sId);
                if (!hasAccess) return null;

                const isActive = currentSalonKey === sId;
                const salonTheme = SALON_COLORS[sId] || {
                  bg: '#2563eb',
                  text: '#1d4ed8',
                  lightBg: '#dbeafe',
                  border: '#60a5fa',
                };

                return (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => handleSelectSalon(sId)}
                    style={
                      isActive
                        ? {
                            backgroundColor: '#1e3a8a',
                            color: '#ffffff',
                            borderColor: '#1e3a8a',
                          }
                        : {
                            backgroundColor: salonTheme.lightBg,
                            color: salonTheme.text,
                            borderColor: salonTheme.border,
                          }
                    }
                    className={`cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 font-semibold transition-all duration-200 ${
                      isActive ? 'scale-105 font-bold shadow-md' : 'hover:opacity-85'
                    }`}
                  >
                    {getSalonLabel(sId)}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] p-4">
              {messages.map((msg) => {
                const authorName = msg.username || msg.sender || 'Inconnu';
                const isMe = authorName === fullName;
                const isAnnouncement = String(authorName).includes('ADMIN');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`relative max-w-[85%] rounded-lg px-3.5 py-2 text-sm shadow-sm ${
                        isAnnouncement
                          ? 'border-2 border-amber-400 bg-amber-100 font-medium text-amber-950'
                          : isMe
                          ? 'rounded-tr-none border border-blue-200 bg-[#dbeafe] text-gray-900'
                          : 'rounded-tl-none bg-white text-gray-900'
                      }`}
                    >
                      {!isMe && (
                        <span className="mb-0.5 block text-[11px] font-bold text-blue-700">
                          {authorName}
                        </span>
                      )}

                      <p className="break-words leading-relaxed">{msg.content}</p>

                      {msg.file_url && msg.file_type === 'audio' && (
                        <audio controls className="mt-2 w-full max-w-xs">
                          <source src={msg.file_url} type="audio/mpeg" />
                        </audio>
                      )}

                      {msg.file_url && msg.file_type === 'video' && (
                        <video
                          controls
                          className="mt-2 max-h-48 w-full rounded-lg object-cover"
                        >
                          <source src={msg.file_url} />
                        </video>
                      )}

                      {msg.file_url && msg.file_type === 'document' && (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-xs font-semibold text-blue-700 underline"
                        >
                          Télécharger le fichier
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="flex shrink-0 items-center gap-2 border-t border-gray-300 bg-[#f0f2f5] p-2.5"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:opacity-50"
                title="Joindre un fichier"
              >
                {uploading ? '...' : '+'}
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Écrire dans ${getSalonLabel(currentSalonKey)}...`}
                className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-[#1e3a8a] focus:outline-none"
              />

              <button
                type="submit"
                className="cursor-pointer rounded-full bg-[#1e3a8a] px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-blue-900"
              >
                Envoyer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}