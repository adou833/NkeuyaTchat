'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [activeCall, setActiveCall] = useState<'audio' | 'video' | null>(null);

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
      setIsLoadingProfile(false);
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
        .eq('salon_id', currentSalonKey)
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
          if (payload.eventType === 'INSERT' && (payload.new as Message).salon_id === currentSalonKey) {
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
        sender: fullName,
        salon_id: currentSalonKey,
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
      alert("Erreur réseau (Failed to fetch) : Vérifie ta connexion ou tes clés Supabase.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_user');
    router.push('/');
  };

  if (isLoadingProfile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#111b21] text-blue-500 font-bold text-sm">
        Chargement du salon NkeuyaTchat... ⏳
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[#111b21] p-0 md:p-4 overflow-hidden">
      <div className="flex flex-col h-full w-full md:h-[90vh] md:w-[440px] md:rounded-[40px] md:border-[8px] md:border-[#1e293b] bg-[#efeae2] relative overflow-hidden shadow-2xl">
        
        {/* EN-TÊTE */}
        <div className="bg-[#1e3a8a] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-blue-400 flex items-center justify-center font-bold text-white shadow-md">
                {fullName ? fullName.charAt(0).toUpperCase() : 'N'}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-current rounded-full"></span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-wide">{fullName}</h2>
              <div className="text-[11px] text-blue-200 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
                <span>{getSalonLabel(currentSalonKey)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setActiveCall('audio')} className="p-2 bg-blue-900/50 hover:bg-blue-800 rounded-full text-white cursor-pointer">📞</button>
            <button onClick={() => setActiveCall('video')} className="p-2 bg-blue-900/50 hover:bg-blue-800 rounded-full text-white cursor-pointer">📹</button>
            {isAdmin && (
              <button onClick={() => setShowAdminPanel(!showAdminPanel)} className={`text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer ${showAdminPanel ? 'bg-amber-600 text-white' : 'bg-amber-500 text-gray-900'}`}>
                {showAdminPanel ? '💬 Chat' : '⚙️ Admin'}
              </button>
            )}
            <button onClick={handleLogout} className="text-xs bg-black/30 hover:bg-black/50 text-white px-2.5 py-1.5 rounded-lg cursor-pointer">Quitter</button>
          </div>
        </div>

        {/* SALONS */}
        <div className="bg-[#f0f2f5] px-3 py-2.5 flex gap-2 overflow-x-auto border-b border-gray-300 text-xs shrink-0">
          {allSalons.map((sId) => {
            const hasAccess = isAdmin || allowedSalons.includes(sId) || sId === 'general' || sId === 'photos-familiales';
            if (!hasAccess) return null;
            const isActive = currentSalonKey === sId;
            return (
              <button
                key={sId}
                onClick={() => setCurrentSalonKey(sId)}
                className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                  isActive ? 'bg-[#1e3a8a] text-white shadow-md scale-105 font-bold' : 'bg-white text-gray-700 hover:bg-gray-100'
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
            const isMe = authorName === fullName;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3.5 py-2 text-sm shadow-sm relative ${
                  isMe ? 'bg-[#dbeafe] text-gray-900 rounded-tr-none border border-blue-200' : 'bg-white text-gray-900 rounded-tl-none'
                }`}>
                  {!isMe && <span className="block text-[11px] font-bold mb-0.5 text-blue-700">{authorName}</span>}
                  <p className="break-words leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ZONE DE SAISIE */}
        <form onSubmit={handleSendMessage} className="p-3 bg-[#f0f2f5] flex items-center gap-2 shrink-0 border-t border-gray-300">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Tapez un message..."
            className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm border border-gray-300 focus:outline-none focus:border-blue-500 text-gray-900"
          />
          <button type="submit" className="bg-[#1e3a8a] text-white p-2.5 rounded-full hover:bg-blue-900 transition cursor-pointer shadow">
            ➤
          </button>
        </form>

      </div>
    </div>
  );
}
