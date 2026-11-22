'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Send, LogOut } from 'lucide-react';

const SALONS = [
  { id: 'general', name: 'Général', icon: '💬' },
  { id: 'photos-familiales', name: 'Photos familiales', icon: '📸' },
  { id: 'femmes', name: 'Femmes', icon: '👩🏾' },
  { id: 'hommes', name: 'Hommes', icon: '👨🏾' },
  { id: 'filles', name: 'Filles', icon: '👧🏾' },
  { id: 'garcons', name: 'Garçons', icon: '👦🏾' },
  { id: 'petits-fils-et-filles', name: 'Petits-fils et filles', icon: '👶🏾' },
];

type GenericRow = Record<string, unknown>;

const TEXT_CANDIDATES = ['contenu', 'message', 'texte', 'content', 'body', 'text'];
const SENDER_CANDIDATES = [
  'expéditeur',
  'expediteur',
  'sender_name',
  'sender',
  'author',
  'auteur',
  'full_name',
];
const DATE_CANDIDATES = ['créer_à', 'cree_a', 'created_at', 'date'];

function pickField(row: GenericRow | null, candidates: string[]): string | null {
  if (!row) return null;
  for (const key of candidates) {
    if (key in row) return key;
  }
  const lowerMap = new Map<string, string>();
  for (const k of Object.keys(row)) {
    lowerMap.set(k.toLowerCase().trim(), k);
  }
  for (const cand of candidates) {
    const found = lowerMap.get(cand.toLowerCase().trim());
    if (found) return found;
  }
  return null;
}

function getSalonIdFromLocation(): string {
  if (typeof window === 'undefined') return 'general';
  const parts = window.location.pathname.split('/').filter(Boolean);
  const salonIndex = parts.indexOf('salon');
  if (salonIndex !== -1 && parts[salonIndex + 1]) {
    return parts[salonIndex + 1];
  }
  return 'general';
}

export default function SalonPage() {
  const router = useRouter();

  const [salonId, setSalonId] = useState<string>(() => getSalonIdFromLocation());
  const [currentUser, setCurrentUser] = useState<string>('');
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [textCol, setTextCol] = useState<string>('contenu');
  const [senderCol, setSenderCol] = useState<string>('expéditeur');
  const [dateCol, setDateCol] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusInfo, setStatusInfo] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const syncSalonFromUrl = useCallback(() => {
    setSalonId(getSalonIdFromLocation());
  }, []);

  useEffect(() => {
    syncSalonFromUrl();
    window.addEventListener('popstate', syncSalonFromUrl);
    return () => {
      window.removeEventListener('popstate', syncSalonFromUrl);
    };
  }, [syncSalonFromUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('chat_user');
      if (saved) {
        setCurrentUser(saved);
      }
    }
  }, []);

  const currentSalon = SALONS.find((s) => s.id === salonId) ?? SALONS[0];

  const detectColumnsFromSample = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').limit(1);
    const sample = Array.isArray(data) && data.length > 0 ? (data[0] as GenericRow) : null;
    if (sample) {
      const detectedText = pickField(sample, TEXT_CANDIDATES);
      const detectedSender = pickField(sample, SENDER_CANDIDATES);
      const detectedDate = pickField(sample, DATE_CANDIDATES);
      if (detectedText) setTextCol(detectedText);
      if (detectedSender) setSenderCol(detectedSender);
      if (detectedDate) setDateCol(detectedDate);
      return {
        textKey: detectedText ?? 'contenu',
        senderKey: detectedSender ?? 'expéditeur',
        dateKey: detectedDate,
      };
    }
    return { textKey: textCol, senderKey: senderCol, dateKey: dateCol };
  }, [textCol, senderCol, dateCol]);

  const loadMessages = useCallback(
    async (targetSalonId: string) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('salon', targetSalonId);

      if (error) {
        setStatusInfo(`Lecture impossible (${targetSalonId}) : ${error.message}`);
        return;
      }

      if (Array.isArray(data)) {
        const list = data as GenericRow[];
        let activeDateKey = dateCol;
        if (list.length > 0) {
          const foundText = pickField(list[0], TEXT_CANDIDATES);
          const foundSender = pickField(list[0], SENDER_CANDIDATES);
          const foundDate = pickField(list[0], DATE_CANDIDATES);
          if (foundText) setTextCol(foundText);
          if (foundSender) setSenderCol(foundSender);
          if (foundDate) {
            activeDateKey = foundDate;
            setDateCol(foundDate);
          }
        }

        const sorted = [...list].sort((a, b) => {
          if (!activeDateKey) return 0;
          const da = a[activeDateKey] ? new Date(String(a[activeDateKey])).getTime() : 0;
          const db = b[activeDateKey] ? new Date(String(b[activeDateKey])).getTime() : 0;
          return da - db;
        });
        setRows(sorted);
      }
    },
    [dateCol]
  );

  useEffect(() => {
    setStatusInfo('');
    void loadMessages(currentSalon.id);
  }, [currentSalon.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [rows.length, currentSalon.id]);

  const handleOpenSalon = (targetId: string) => {
    setSalonId(targetId);
    router.push(`/salon/${targetId}`);
  };

  const sendMessageNow = async () => {
    const clean = text.trim();
    if (!clean) {
      setStatusInfo(`Écrivez un message dans ${currentSalon.name} avant d’envoyer.`);
      return;
    }
    if (sending) return;

    const targetSalonId = currentSalon.id;
    setSending(true);
    setStatusInfo(`Envoi vers ${currentSalon.name}...`);

    try {
      const sender =
        currentUser ||
        (typeof window !== 'undefined' && window.localStorage.getItem('chat_user')) ||
        'Eric MABOM';

      const detected = await detectColumnsFromSample();
      const candidateTextCols = Array.from(
        new Set([detected.textKey, textCol, ...TEXT_CANDIDATES])
      );

      let insertedRow: GenericRow | null = null;
      let lastErrorMsg = '';

      for (const candidateCol of candidateTextCols) {
        const payload: GenericRow = {
          salon: targetSalonId,
          [detected.senderKey]: sender,
          [candidateCol]: clean,
        };

        const { data, error } = await supabase
          .from('messages')
          .insert([payload])
          .select('*');

        if (!error) {
          setTextCol(candidateCol);
          if (Array.isArray(data) && data.length > 0) {
            insertedRow = data[0] as GenericRow;
          }
          lastErrorMsg = '';
          break;
        }

        lastErrorMsg = error.message;
        const isMissingCol =
          error.message.includes('schema cache') || error.message.includes('column');
        if (!isMissingCol) {
          break;
        }
      }

      if (lastErrorMsg) {
        setStatusInfo(`Erreur Supabase (${targetSalonId}) : ${lastErrorMsg}`);
        return;
      }

      setText('');
      setStatusInfo(`Message envoyé dans ${currentSalon.name}.`);

      if (insertedRow) {
        setRows((prev) => [...prev, insertedRow as GenericRow]);
      } else {
        await loadMessages(targetSalonId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setStatusInfo(`Erreur (${targetSalonId}) : ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendMessageNow();
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
          {statusInfo && (
            <div className="bg-white/95 text-gray-800 text-xs p-2.5 rounded-xl border border-sky-200 font-medium">
              {statusInfo}
            </div>
          )}
          {rows.map((row, idx) => {
            const rowKey = typeof row.id === 'string' && row.id ? row.id : String(idx);
            const authorVal = row[senderCol];
            const bodyVal = row[textCol];
            const authorLabel =
              typeof authorVal === 'string' && authorVal.trim() ? authorVal : 'Membre';
            const bodyLabel = typeof bodyVal === 'string' ? bodyVal : '';

            return (
              <div
                key={rowKey}
                className="bg-white rounded-xl px-3.5 py-2.5 border border-gray-200/80 text-xs"
              >
                <p className="font-bold text-[#0284c7]">{authorLabel}</p>
                <p className="text-gray-800 mt-0.5 whitespace-pre-wrap break-words">
                  {bodyLabel}
                </p>
              </div>
            );
          })}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessageNow();
              }
            }}
            placeholder={`Écrire dans ${currentSalon.name}...`}
            className="flex-1 bg-white border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[#0284c7]"
          />
          <button
            type="button"
            onClick={() => void sendMessageNow()}
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