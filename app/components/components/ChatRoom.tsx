'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  content: string;
  sender_name?: string;
  created_at: string;
}

export default function ChatRoom({ roomId, userName }: { roomId: string; userName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // await supabase.from('messages').insert([{ content: newMessage, room_id: roomId, sender_name: userName }]);
    
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gray-100 overflow-hidden">
      
      {/* 1. En-tête du salon */}
      <header className="flex-shrink-0 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <h1 className="font-bold text-lg text-gray-800">Salon de discussion</h1>
        <span className="text-sm text-green-600 font-medium">● En ligne</span>
      </header>

      {/* 2. Liste des messages (min-h-0 est indispensable pour empêcher le débordement sur mobile) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            Aucun message pour l'instant. Soyez le premier à écrire !
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-white p-3 rounded-lg shadow-sm max-w-[80%]">
              <p className="text-xs font-bold text-indigo-600">{msg.sender_name || 'Anonyme'}</p>
              <p className="text-sm text-gray-800 mt-1">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Barre de saisie fixée proprement en bas avec la safe-area mobile */}
      <div className="flex-shrink-0 bg-white border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg">
        <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrivez votre message..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-indigo-700 transition active:scale-95"
          >
            Envoyer
          </button>
        </form>
      </div>

    </div>
  );
}