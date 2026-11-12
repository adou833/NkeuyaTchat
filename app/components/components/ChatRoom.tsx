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
  avatar_url?: string;
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

export default function ChatRoom() {
  const router = useRouter();
  const [currentSalonKey, setCurrentSalonKey] = useState<string>('general');

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [fullName, setFullName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [allowedSalons, setAllowedSalons] = useState<string[]>(['general', 'photos-familiales']);
  const [allSalons, setAllSalons] = useState<string[]>(DEFAULT_SALONS.map(s => s.id));
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Thème de fond d'écran (Clair, Sombre, Bleu Nkeuya)
  const [chatTheme, setChatTheme] = useState<'clair' | 'sombre' | 'bleu'>('clair');

  // Notifications non lues par salon
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const ADMIN_NAME = "Eric MABOM";
  const isAdmin = fullName.toLowerCase() === ADMIN_NAME.toLowerCase();

  const getSalonLabel = (sId: string) => {
    const found = DEFAULT_SALONS.find(s => s.id === sId);
    if (found) return found.label;
    return sId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Son de notification style WhatsApp
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const handleSelectSalon = (salonId: string) => {
    setCurrentSalonKey(salonId);
    setUnreadCounts((prev) => ({ ...prev, [salonId]: 0 }));
  };

  useEffect(() => {
    const user = localStorage.getItem('chat_user');
    if (!user) {
      router.push('/');
      return;
    }
    setFullName(user);

    // Charger le thème enregistré s'il existe
    const savedTheme = localStorage.getItem('chat_theme') as 'clair' | 'sombre' | 'bleu';
    if (savedTheme) setChatTheme(savedTheme);

    const initProfile = async () => {
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) {
        setAdminUsers(usersData);
        
        const currentUserRecord = usersData.find(u => u.full_name.toLowerCase() === user.toLowerCase());
        if (currentUserRecord && currentUserRecord.avatar_url) {
          setUserAvatar(currentUserRecord.avatar_url);
        }

        const dynamicSalons = new Set(DEFAULT_SALONS.map(s => s.id));
        usersData.forEach(u => u.salons?.forEach((s: string) => dynamicSalons.add(s)));
        const salonList = Array.from(dynamicSalons);
        setAllSalons(salonList);

        if (user.toLowerCase() === ADMIN_NAME.toLowerCase()) {
          setAllowedSalons(salonList);
        } else {
          if (currentUserRecord) {
            if (currentUserRecord.status !== 'valide') {
              router.push('/');
              return;
            }
            const userSalons = currentUserRecord.salons && currentUserRecord.salons.length > 0 
              ? Array.from(new Set(['general', 'photos-familiales', ...currentUserRecord.salons]))
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

  const changeTheme = (newTheme: 'clair' | 'sombre' | 'bleu') => {
    setChatTheme(newTheme);
    localStorage.setItem('chat_theme', newTheme);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fullName) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);

    if (uploadError) {
      alert("Erreur lors de l'envoi de la photo : " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('chat_media').getPublicUrl(filePath);
    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('full_name', fullName);

    if (updateError) {
      alert("Erreur lors de l'enregistrement de l'avatar : " + updateError.message);
    } else {
      setUserAvatar(avatarUrl);
      alert("Photo de profil mise à jour avec succès !");
    }
    setUploading(false);
  };

  useEffect(() => {
    if (!fullName) return;

    const globalChannel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.username?.toLowerCase() !== fullName.toLowerCase() && newMsg.salon !== currentSalonKey) {
            playNotificationSound();
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.salon]: (prev[newMsg.salon] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [currentSalonKey, fullName]);

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

    let fileType: 'image' | 'audio' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type.startsWith('audio/')) fileType = 'audio';
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
      content: fileType === 'image' ? `📷 Photo partagée` : fileType === 'video' ? `🎬 Vidéo partagée` : `📁 Fichier partagé : ${file.name}`,
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

  const handleDeleteMessage = async (msg: Message) => {
    const author = msg.username || msg.sender;
    const isOwner = author?.toLowerCase() === fullName.toLowerCase();

    if (!isOwner && !isAdmin) {
      alert("Tu ne peux supprimer que tes propres messages !");
      return;
    }

    if (!confirm("⚠️ Supprimer ce message ou fichier ?")) return;

    const { error } = await supabase.from('messages').delete().eq('id', msg.id);
    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }
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

  const deleteMessageAdmin = async (msgId: string) => {
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

  // Classes de fond d'écran selon le thème choisi
  const getThemeBackground = () => {
    if (chatTheme === 'sombre') return 'bg-[#111b21] text-gray-100';
    if (chatTheme === 'bleu') return 'bg-[#0c2340] text-gray-100';
    return 'bg-[#efeae2] text-gray-900'; // Clair
  };

  const getMessageBubbleStyle = (isMe: boolean) => {
    if (chatTheme === 'sombre') {
      return isMe ? 'bg-[#005c4b] text-white rounded-tl-none' : 'bg-[#202c33] text-white rounded-tr-none';
    }
    if (chatTheme === 'bleu') {
      return isMe ? 'bg-[#0284c7] text-white rounded-tl-none' : 'bg-[#1e3a8a] text-white rounded-tr-none';
    }
    return isMe ? 'bg-white text-gray-900 rounded-tl-none' : 'bg-[#d9fdd3] text-gray-900 rounded-tr-none';
  };

  return (
    <div className="flex items-center justify-center h-[100dvh] w-full max-w-full bg-[#111b21] p-0 md:p-4 overflow-hidden">
      
      {/* CADRE SMARTPHONE HARMONISÉ EN BLEU CLAIR (#0284c7) */}
      <div className="flex flex-col h-full w-full max-w-full md:h-[90vh] md:w-[440px] md:rounded-[40px] md:border-[8px] md:border-[#0284c7] bg-[#efeae2] relative overflow-hidden shadow-2xl">
        
        {/* EN-TÊTE BLEU CLAIR */}
        <div className="bg-[#0284c7] text-white px-3 py-2.5 flex items-center justify-between shadow-md z-10 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarUpload}
              className="hidden"
              accept="image/*"
            />
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="relative shrink-0 cursor-pointer group"
              title="Changer ma photo de profil"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-sky-200 shadow-md group-hover:opacity-80 transition" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sky-500 border-2 border-sky-200 flex items-center justify-center font-bold text-white shadow-md group-hover:opacity-80 transition">
                  {fullName ? fullName.charAt(0).toUpperCase() : 'N'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-current rounded-full"></span>
            </div>
            <div className="truncate">
              <h2 className="font-bold text-sm text-white tracking-wide truncate">{fullName || 'Utilisateur'}</h2>
              <div className="text-xs text-sky-100 flex items-center gap-1.5 font-medium truncate">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block shrink-0"></span>
                <span className="truncate">{getSalonLabel(currentSalonKey)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* SÉLECTEUR DE THÈME RAPIDE */}
            <select
              value={chatTheme}
              onChange={(e) => changeTheme(e.target.value as any)}
              className="bg-sky-800 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg border border-sky-600 outline-none cursor-pointer"
              title="Changer le fond d'écran"
            >
              <option value="clair">☀️ Clair</option>
              <option value="sombre">🌙 Sombre</option>
              <option value="bleu">🔵 Bleu</option>
            </select>

            <button
              onClick={() => setActiveCallType('audio')}
              className="p-2 bg-sky-800/40 hover:bg-sky-700/60 rounded-full transition text-white shadow cursor-pointer text-sm"
              title="Appel audio"
            >
              📞
            </button>
            <button
              onClick={() => setActiveCallType('video')}
              className="p-2 bg-sky-800/40 hover:bg-sky-700/60 rounded-full transition text-white shadow cursor-pointer text-sm"
              title="Appel vidéo"
            >
              📹
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition shadow cursor-pointer ${
                  showAdminPanel ? 'bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-gray-900'
                }`}
              >
                {showAdminPanel ? '💬 Chat' : '⚙️ Admin'}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-xs bg-black/20 hover:bg-black/40 text-white px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              Quitter
            </button>
          </div>
        </div>

        {/* Modal d'appel Jitsi Meet */}
        {activeCallType && (
          <div className="absolute inset-0 bg-black/90 z-50 flex flex-col">
            <div className="bg-[#0284c7] text-white p-3 flex justify-between items-center shrink-0">
              <span className="font-bold text-sm">
                {activeCallType === 'video' ? '📹 Appel Vidéo' : '📞 Appel Audio'} - {getSalonLabel(currentSalonKey)}
              </span>
              <button
                onClick={() => setActiveCallType(null)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-full font-bold cursor-pointer shadow"
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
            <div className="bg-[#0284c7] p-2 flex items-center justify-between border-b border-sky-800 overflow-x-auto shrink-0 gap-2">
              <div className="flex gap-1.5 overflow-x-auto flex-1">
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
                    className={`text-xs px-3 py-2 rounded-lg font-semibold transition shrink-0 cursor-pointer ${
                      adminTab === tab.id ? 'bg-sky-600 text-white shadow' : 'bg-[#111b21] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="bg-sky-700 hover:bg-sky-800 text-white p-2 rounded-lg font-bold shrink-0 transition flex items-center gap-1 shadow cursor-pointer disabled:opacity-50 text-xs"
                title="Rafraîchir"
              >
                <span>{isRefreshing ? '⏳' : '🔄'}</span>
              </button>
            </div>

            <div className="p-4 flex-1 space-y-4">
              {adminTab === 'users' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-sky-400 uppercase">Gestion des Membres et Validations</h3>
                  {adminUsers.map((u) => (
                    <div key={u.id} className="bg-[#1e293b] p-3.5 rounded-xl border border-sky-900 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-sky-400" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white text-xs font-bold">
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-sm text-gray-100">{u.full_name}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                              u.status === 'valide' ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' :
                              u.status === 'refuse' ? 'bg-red-900 text-red-300 border border-red-700' :
                              'bg-amber-900 text-amber-300 border border-amber-700'
                            }`}>
                              {u.status || 'en_attente'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteUserAccount(u)}
                          className="text-xs bg-red-950 text-red-300 px-2.5 py-1 rounded-lg border border-red-800 font-bold cursor-pointer"
                        >
                          🗑️ Suppr.
                        </button>
                      </div>

                      <div className="bg-[#111b21] p-2.5 rounded-lg border border-sky-900 space-y-2">
                        <span className="text-xs font-bold text-sky-400 uppercase">Salons autorisés :</span>
                        <div className="flex flex-wrap gap-2">
                          {allSalons.map((sId) => {
                            const userSalonsArr = Array.isArray(u.salons) ? u.salons : [];
                            const hasAccess = userSalonsArr.includes(sId) || sId === 'general' || sId === 'photos-familiales';
                            return (
                              <button
                                key={sId}
                                onClick={() => toggleSalonUser(u, sId)}
                                className={`text-xs px-3 py-1.5 rounded-md border transition font-medium flex items-center gap-1 cursor-pointer ${
                                  hasAccess ? 'bg-sky-600 text-white border-sky-400' : 'bg-[#1e293b] text-gray-400 border-gray-700'
                                }`}
                              >
                                <span>{hasAccess ? '✓' : '+'}</span>
                                <span>{getSalonLabel(sId)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-[#111b21] p-2.5 rounded-lg border border-sky-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-400 uppercase">Mot de passe :</span>
                          <button
                            onClick={() => { setEditingPasswordUserId(editingPasswordUserId === u.id ? null : u.id); setNewPasswordInput(''); }}
                            className="text-xs bg-sky-700 text-white px-2.5 py-1 rounded font-semibold cursor-pointer"
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
                              className="flex-1 bg-[#1e293b] border border-sky-800 rounded px-2.5 py-1.5 text-sm text-white"
                            />
                            <button
                              onClick={() => handleSavePasswordFromUsersTab(u.id, u.full_name)}
                              className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-bold cursor-pointer"
                            >
                              Enregistrer
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-sky-900 flex-wrap gap-2">
                        <button
                          onClick={() => updateUserStatus(u.id, 'en_attente')}
                          className="text-xs bg-gray-800 hover:bg-gray-700 text-amber-300 px-3 py-1.5 rounded border border-amber-900/50 cursor-pointer"
                        >
                          🔄 Remettre en attente
                        </button>

                        <div className="flex gap-2">
                          {u.status !== 'valide' && (
                            <button
                              onClick={() => updateUserStatus(u.id, 'valide')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded font-bold cursor-pointer shadow"
                            >
                              ✅ Valider l'inscription
                            </button>
                          )}
                          {u.status !== 'refuse' && (
                            <button
                              onClick={() => updateUserStatus(u.id, 'refuse')}
                              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded font-bold cursor-pointer shadow"
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
                  <h3 className="text-xs font-semibold text-sky-400 uppercase">Gestion des Mots de passe</h3>
                  {adminUsers.map((u) => (
                    <div key={u.id} className="bg-[#1e293b] p-3.5 rounded-xl border border-sky-900 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-100">{u.full_name}</span>
                        <button
                          onClick={() => { setEditingPasswordUserId(editingPasswordUserId === u.id ? null : u.id); setNewPasswordInput(''); }}
                          className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          {editingPasswordUserId === u.id ? 'Annuler' : '🔑 Modifier'}
                        </button>
                      </div>
                      {editingPasswordUserId === u.id && (
                        <div className="pt-2 border-t border-sky-900 flex gap-2">
                          <input
                            type="text"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Nouveau mot de passe"
                            className="flex-1 bg-[#111b21] border border-sky-800 rounded-lg px-3 py-1.5 text-sm text-white"
                          />
                          <button onClick={() => handleSavePasswordFromUsersTab(u.id, u.full_name)} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer">OK</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'salons' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddSalon} className="bg-[#1e293b] p-4 rounded-xl border border-sky-900 space-y-3">
                    <h4 className="text-xs font-bold text-sky-400 uppercase">➕ Créer un salon</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSalonName}
                        onChange={(e) => setNewSalonName(e.target.value)}
                        placeholder="Nom..."
                        required
                        className="flex-1 bg-[#111b21] border border-sky-800 rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <button type="submit" className="bg-sky-600 text-white text-xs px-4 py-2 rounded-lg font-bold cursor-pointer">Ajouter</button>
                    </div>
                  </form>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-sky-400 uppercase">Salons Actifs</h4>
                    {allSalons.map((sId) => (
                      <div key={sId} className="bg-[#1e293b] p-3 rounded-lg border border-sky-900 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-200">{getSalonLabel(sId)}</span>
                        {sId !== 'general' && sId !== 'photos-familiales' && (
                          <button onClick={() => purgeSalon(sId)} className="bg-red-950 text-red-400 text-xs px-2.5 py-1 rounded cursor-pointer">🗑️ Purger</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'en_ligne' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-sky-400 uppercase">Membres connectés ({onlineUsers.length})</h3>
                  {onlineUsers.map((name, index) => (
                    <div key={index} className="bg-[#1e293b] p-3 rounded-lg border border-sky-900 text-sm font-bold">{name}</div>
                  ))}
                </div>
              )}

              {adminTab === 'moderation' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-sky-400 uppercase">Modération</h3>
                  {adminMessages.map((msg) => (
                    <div key={msg.id} className="bg-[#1e293b] p-3 rounded-lg border border-sky-900 flex justify-between items-center gap-2">
                      <div>
                        <span className="text-xs font-bold text-sky-400">{msg.username}</span>
                        <p className="text-sm text-gray-200 truncate">{msg.content}</p>
                      </div>
                      <button onClick={() => deleteMessageAdmin(msg.id)} className="bg-red-600 text-white text-xs px-2.5 py-1.5 rounded cursor-pointer">Supprimer</button>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'annonces' && (
                <form onSubmit={handleSendAnnouncement} className="bg-[#1e293b] p-4 rounded-xl border border-sky-900 space-y-3">
                  <h3 className="text-xs font-bold text-sky-400 uppercase">Annonce officielle</h3>
                  <textarea
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Écrire une annonce visible dans le salon actif..."
                    required
                    className="w-full bg-[#111b21] border border-sky-800 rounded-lg p-3 text-sm text-white h-24 resize-none"
                  />
                  <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-lg font-bold text-sm cursor-pointer">Diffuser l'annonce</button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* SECTION PRINCIPALE DU CHAT AVEC THÈME DYNAMIQUE */
          <div className="flex-1 flex flex-col w-full max-w-full overflow-hidden relative">
            
            {/* BARRE DES SALONS */}
            <div className="bg-[#111b21] px-2.5 py-2.5 flex gap-2 overflow-x-auto shrink-0 border-b border-sky-900/40 w-full">
              {allowedSalons.map((sId) => {
                const isActive = currentSalonKey === sId;
                const unreadCount = unreadCounts[sId] || 0;
                return (
                  <button
                    key={sId}
                    onClick={() => handleSelectSalon(sId)}
                    className={`text-sm px-4 py-2 rounded-full font-semibold transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                      isActive
                        ? 'bg-[#0284c7] text-white shadow-md'
                        : 'bg-[#202c33] text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    <span>{getSalonLabel(sId)}</span>
                    {unreadCount > 0 && (
                      <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* LISTE DES MESSAGES AVEC FOND D'ÉCRAN DYNAMIQUE */}
            <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 w-full ${getThemeBackground()}`}>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full opacity-60 text-sm italic text-center px-4">
                  Aucun message dans ce salon pour l'instant. Envoyez le premier !
                </div>
              ) : (
                messages.map((msg) => {
                  const author = msg.username || msg.sender;
                  const isMe = author?.toLowerCase() === fullName.toLowerCase();

                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full ${isMe ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm relative group break-words ${getMessageBubbleStyle(isMe)}`}
                      >
                        {!isMe && (
                          <div className="text-xs font-bold text-sky-400 mb-0.5">
                            {author}
                          </div>
                        )}

                        {/* Médias partagés */}
                        {msg.file_url && (
                          <div className="mb-2">
                            {msg.file_type === 'image' ? (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={msg.file_url}
                                  alt="Média partagé"
                                  className="rounded-lg max-h-48 max-w-full object-cover cursor-pointer hover:opacity-95 transition"
                                />
                              </a>
                            ) : msg.file_type === 'audio' ? (
                              <audio controls className="w-full max-w-[220px] max-h-10">
                                <source src={msg.file_url} />
                                Votre navigateur ne supporte pas l'audio.
                              </audio>
                            ) : msg.file_type === 'video' ? (
                              <video controls className="rounded-lg max-h-48 max-w-full">
                                <source src={msg.file_url} />
                                Votre navigateur ne supporte pas la vidéo.
                              </video>
                            ) : (
                              <a
                                href={msg.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-sky-400 underline font-semibold flex items-center gap-1 break-all"
                              >
                                📎 Télécharger le fichier
                              </a>
                            )}
                          </div>
                        )}

                        <p className="text-sm whitespace-pre-wrap break-words leading-snug">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <span className="text-[11px] opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(isMe || isAdmin) && (
                            <button
                              onClick={() => handleDeleteMessage(msg)}
                              className="text-xs text-red-400 hover:text-red-500 opacity-60 hover:opacity-100 transition cursor-pointer ml-1"
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ZONE DE SAISIE */}
            <form onSubmit={handleSendMessage} className="bg-[#f0f2f5] p-2.5 flex items-center gap-2 border-t border-gray-300 shrink-0 w-full">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 text-gray-600 hover:text-[#0284c7] transition cursor-pointer disabled:opacity-50 shrink-0 text-lg"
                title="Joindre un fichier ou une photo"
              >
                📎
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Écrivez un message..."
                className="flex-1 min-w-0 bg-white border border-gray-300 rounded-full px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#0284c7]"
              />

              <button
                type="submit"
                className="bg-[#0284c7] hover:bg-sky-700 text-white px-4 py-2.5 rounded-full text-sm font-bold transition shadow cursor-pointer shrink-0"
              >
                Envoyer
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
