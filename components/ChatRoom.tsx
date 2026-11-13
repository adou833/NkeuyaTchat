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

  // État du mode sombre
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // Notifications globales sur tous les salons
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

  // Messages du salon actif
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

  return (
    <div className="flex items-center justify-center h-[100dvh] w-full max-w-full bg-[#111b21] p-0 md:p-4 overflow-hidden">
      
      {/* CADRE SMARTPHONE HARMONISÉ EN BLEU CLAIR (#0284c7) */}
      <div className="flex flex-col h-full w-full max-w-full md:h-[90vh] md:w-[440px] md:rounded-[40px] md:border-[8px] md:border-[#0284c7] bg-[#efeae2] relative overflow-hidden shadow-2xl">
        
        {/* EN-TÊTE BLEU CLAIR */}
        <div className="bg-[#0284c7] text-white px-3 py-2.5 flex items-center justify-between shadow-md z-10 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-sky-500 border-2 border-sky-200 flex items-center justify-center font-bold text-white shadow-md">
                {fullName ? fullName.charAt(0).toUpperCase() : 'N'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-current rounded-full"></span>
            </div>
            <div className="truncate">
              <h2 className="font-bold text-xs text-white tracking-wide truncate">{fullName || 'Utilisateur'}</h2>
              <div className="text-[10px] text-sky-100 flex items-center gap-1 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block shrink-0"></span>
                <span className="truncate">{getSalonLabel(currentSalonKey)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bouton Mode Sombre */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 bg-sky-800/40 hover:bg-sky-700/60 rounded-full transition text-white shadow cursor-pointer text-xs"
              title="Activer/Désactiver le mode sombre"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>

            <button
              onClick={() => setActiveCallType('audio')}
              className="p-1.5 bg-sky-800/40 hover:bg-sky-700/60 rounded-full transition text-white shadow cursor-pointer text-xs"
              title="Appel audio"
            >
              📞
            </button>
            <button
              onClick={() => setActiveCallType('video')}
              className="p-1.5 bg-sky-800/40 hover:bg-sky-700/60 rounded-full transition text-white shadow cursor-pointer text-xs"
              title="Appel vidéo"
            >
              📹
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition shadow cursor-pointer ${
                  showAdminPanel ? 'bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-gray-900'
                }`}
              >
                {showAdminPanel ? '💬 Chat' : '⚙️ Admin'}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-[11px] bg-black/20 hover:bg-black/40 text-white px-2 py-1 rounded-lg transition cursor-pointer"
            >
              Quitter
            </button>
          </div>
        </div>

        {/* Modal d'appel Jitsi Meet */}
        {activeCallType && (
          <div className="absolute inset-0 bg-black/90 z-50 flex flex-col">
            <div className="bg-[#0284c7] text-white p-3 flex justify-between items-center shrink-0">
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
            <div className="flex-1 w-full h-
