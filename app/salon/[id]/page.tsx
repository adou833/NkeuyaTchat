'use client';

import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Send, LogOut, MessageCircle } from 'lucide-react';

const SALONS = [
  { id: 'general', name: 'Général', icon: '💬' },
  { id: 'photos-familiales', name: 'Photos familiales', icon: '📸' },
  { id: 'femmes', name: 'Femmes', icon: '👩🏾' },
  { id: 'hommes', name: 'Hommes', icon: '👨🏾' },
  { id: 'filles', name: 'Filles', icon: '👧🏾' },
  { id: 'garcons', name: 'Garçons', icon: '👦🏾' },
  { id: 'petits-fils-et-filles', name: 'Petits-fils et filles', icon: '👶🏾' },
];

interface MessageRow {
  id: string;
  salon_id: string;
  sender_name: string | null;
  content: string | null;
  created_at: string;
}

function SalonContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeSalonId = typeof params?.id === 'string' ? params.id : 'general';

  const [activeSalonId, setActiveSalonId] = useState<string>(routeSalonId);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    setActiveSalonId(routeSalonId);
  }, [routeSalonId]);

  useEffect(() => {
    const saved =
      typeof window !== 'undefined' ? window.localStorage.getItem('chat_user') : null;
    if (saved) {
      setCurrentUser(saved);
    }
  }, []);

  const currentSalon =
    SALONS.find((s) => s.id === activeSalonId) ?? SALONS[0];

  const loadMessages = useCallback(async (targetSalonId: string) => {
    const seq = ++requestSeqRef.current;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('salon_id', targetSalonId)
      .order('created_at', { ascending: true });

    if (seq === requestSeqRef.current && Array.isArray(data)) {
      setMessages(data as MessageRow[]);
    }
  }, []);

  useEffect(() => {
    void loadMessages(currentSalon.id);
  }, [currentSalon.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length, currentSalon.id]);

  const handleOpenSalon = (targetId: string) => {
    if (targetId === currentSalon.id) return;
    setActiveSalonId(targetId);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/salon/${targetId}`);
    }
  };

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;

    setSending(true);
    try {
      const sender = currentUser || 'Eric MABOM';
      const { error } = await supabase.from('messages').insert([
        {
          salon_id: currentSalon.id,
          sender_name: sender,
          content: clean,
        },
      ]);
      if (!error) {
        setText('');
        await loadMessages(currentSalon.id);
      }
    } finally {
      setSending(false);
    }
  };

  const handleQuit = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('chat_user');
    }
    router.replace('/');
  };

  return (
    <main className="h-[100dvh] w-screen flex justify-center items-center bg-[#dadbd4] overflow-hidden select-none">
      <div className="w-full h-full sm:max-w-md sm:h-[92vh] sm:rounded-3xl sm:shadow-2xl flex flex-col bg-[#efeae2] overflow-hidden border border-gray-300">
        <header className="bg-[#0284c7] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="p-2 rounded-full bg-sky-700/60 hover:bg-sky-800 cursor-pointer shrink-0"
              title="Accueil"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xl shrink-0">{currentSalon.icon}</span>
            <div className="min-w-0">
              <h1 className="font-bold text-base truncate">{currentSalon.name}</h1>
              <p className="text-[11px] text-sky-100 truncate">
                {currentUser || 'Membre'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuit}
            className="p-2 rounded-full bg-sky-700/60 hover:bg-sky-800 cursor-pointer flex items-center gap-1 text-xs shrink-0"
            title="Quitter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <nav className="bg-[#f0f2f5] border-b border-gray-300 py-2.5 px-3 shrink-0 overflow-x-auto flex gap-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {SALONS.map((salon) => {
            const active = salon.id === currentSalon.id;
            return (
              <button
                key={salon.id}
                type="button"
                onClick={() => handleOpenSalon(salon.id)}
                className={`flex flex-col items-center shrink-0 cursor-pointer w-16 rounded-xl py-1 ${
                  active ? 'bg-sky-100 border border-[#0284c7]' : ''
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-lg">
                  {salon.icon}
                </div>
                <span className="text-[10px] text-gray-800 font-medium text-center mt-1 truncate w-full">
                  {salon.name}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 select-text">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white rounded-xl px-3.5 py-2.5 border border-gray-200/80 text-xs"
            >
              <p className="font-bold text-[#0284c7]">
                {msg.sender_name || 'Membre'}
              </p>
              <p className="text-gray-800 mt-0.5 whitespace-pre-wrap break-words">
                {msg.content}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="bg-[#f0f2f5] border-t border-gray-300 p-3 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire un message..."
            className="flex-1 bg-white border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[#0284c7]"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-[#0284c7] hover:bg-sky-700 text-white p-2.5 rounded-full cursor-pointer shrink-0"
            title="Envoyer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}

function SalonFallback() {
  return (
    <main className="h-[100dvh] w-screen flex justify-center items-center bg-[#dadbd4] overflow-hidden">
      <div className="w-full h-full sm:max-w-md sm:h-[92vh] sm:rounded-3xl sm:shadow-2xl flex flex-col bg-[#efeae2] overflow-hidden border border-gray-300">
        <header className="bg-[#0284c7] text-white px-4 py-3.5 flex items-center gap-2.5 shrink-0">
          <MessageCircle className="w-5 h-5 text-white" />
          <h1 className="font-bold text-base">NkeuyaTchat</h1>
        </header>
        <div className="flex-1 bg-[#efeae2]" />
      </div>
    </main>
  );
}

export default function SalonPage() {
  return (
    <Suspense fallback={<SalonFallback />}>
      <SalonContent />
    </Suspense>
  );
}