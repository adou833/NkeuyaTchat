'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Send, 
  Image as ImageIcon, 
  FileText, 
  Mic, 
  Square, 
  ArrowLeft, 
  Phone, 
  Video, 
  CheckCheck, 
  Download,
  Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  salon: string;
  sender: string;
  content: string;
  file_url?: string;
  file_type?: string;
  file_name?: string;
  created_at: string;
  reactions?: { [emoji: string]: string[] };
}

interface ChatRoomProps {
  salonId: string;
}

const ADMIN_NAME = "Eric MABOM";
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🙏'];

export default function ChatRoom({ salonId }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [fullName, setFullName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [allowedSalons, setAllowedSalons] = useState<string[]>([]);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  
  // États pour l'enregistrement audio
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const salonTitles: { [key: string]: string } = {
    general: 'Général',
    femmes: 'Femmes',
    hommes: 'Hommes',
    filles: 'Filles',
    garcons: 'Garçons',
    'petits-fils-et-filles': 'Petits-fils et filles'
  };

  const currentTitle = salonTitles[salonId] || salonId;

  // Charger l'utilisateur et les salons autorisés
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
      } catch (e) {
        setAllowedSalons(['general']);
      }
    }
  }, [router]);

  // Charger les messages et écouter le Realtime
  useEffect(() => {
    if (!salonId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('salon', salonId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`room-${salonId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `salon=eq.${salonId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) => prev.map((msg) => msg.id === updatedMsg.id ? updatedMsg : msg));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const deletedId = payload.old.id;
          setMessages((prev) => prev.filter((msg) => msg.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId]);

  // Scroll automatique en bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envoyer un message texte
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !fullName) return;

    const contentToSend = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert([
      {
        salon: salonId,
        sender: fullName,
        content: contentToSend,
        reactions: {},
      },
    ]);

    if (error) {
      console.error("Erreur lors de l'envoi du message :", error);
    }
  };

  // Ajouter ou retirer une réaction émoji
  const handleToggleReaction = async (messageId: string, emoji: string, currentReactions?: { [key: string]: string[] }) => {
    if (!fullName) return;

    const reactions = currentReactions ? { ...currentReactions } : {};
    const userList = reactions[emoji] ? [...reactions[emoji]] : [];
    const userIndex = userList.indexOf(fullName);

    if (userIndex > -1) {
      userList.splice(userIndex, 1);
      if (userList.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = userList;
      }
    } else {
      userList.push(fullName);
      reactions[emoji] = userList;
    }

    setActiveEmojiPicker(null);

    await supabase
      .from('messages')
      .update({ reactions })
      .eq('id', messageId);
  };

  // Envoyer un fichier (image ou document)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file || !fullName) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${salonId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) {
        alert("Erreur lors de l'envoi du fichier : " + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      await supabase.from('messages').insert([
        {
          salon: salonId,
          sender: fullName,
          content: fileType === 'image' ? '📷 Image' : `📎 ${file.name}`,
          file_url: publicUrlData.publicUrl,
          file_type: fileType,
          file_name: file.name,
          reactions: {},
        },
      ]);
    } catch (err: any) {
      alert("Erreur inattendue : " + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Enregistrement Audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioFile(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioFile = async (blob: Blob) => {
    if (!fullName) return;
    setUploading(true);
    try {
      const fileName = `audio-${Date.now()}.webm`;
      const filePath = `${salonId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob);

      if (uploadError) {
        alert("Erreur d'envoi audio : " + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      await supabase.from('messages').insert([
        {
          salon: salonId,
          sender: fullName,
          content: '🎤 Message vocal',
          file_url: publicUrlData.publicUrl,
          file_type: 'audio',
          file_name: 'Message vocal',
          reactions: {},
        },
      ]);
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Supprimer un message (Admin ou auteur)
  const handleDeleteMessage = async (messageId: string, sender: string) => {
    if (fullName !== ADMIN_NAME && fullName !== sender) return;
    if (!confirm("Voulez-vous supprimer ce message ?")) return;

    await supabase.from('messages').delete().eq('id', messageId);
  };

  return (
    <div className="flex flex-col h-full bg-[#efeae2] relative overflow-hidden">
      
      {/* En-tête du Salon */}
      <header className="bg-[#0284c7] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => router.push('/salon/general')} 
            className="p-1 rounded-full hover:bg-sky-600 transition cursor-pointer"
            title="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg shadow">
            💬
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base leading-tight">Salon : {currentTitle}</h2>
            <p className="text-[11px] text-sky-100">Espace familial sécurisé</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button 
            onClick={() => alert("Fonctionnalité d'appel vocal bientôt disponible")}
            className="p-2 rounded-full hover:bg-sky-600 transition cursor-pointer"
            title="Appel vocal"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button 
            onClick={() => alert("Fonctionnalité d'appel vidéo bientôt disponible")}
            className="p-2 rounded-full hover:bg-sky-600 transition cursor-pointer"
            title="Appel vidéo"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Corps des Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[radial-gradient(#e5ddd5_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.map((msg) => {
          const isMe = msg.sender === fullName;
          const isAdmin = fullName === ADMIN_NAME;
          const canDelete = isMe || isAdmin;
          const showPicker = activeEmojiPicker === msg.id;

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative my-3`}
            >
              <div className="relative max-w-[85%] sm:max-w-[70%]">
                
                {/* Palette pop-up d'émojis (Façon WhatsApp : apparaît directement au-dessus de la bulle au clic) */}
                {showPicker && (
                  <div className="absolute z-30 -top-12 left-1/2 -translate-x-1/2 bg-white border border-gray-300 shadow-2xl rounded-full px-3 py-1.5 flex items-center space-x-2 animate-in fade-in zoom-in duration-150 whitespace-nowrap">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji, msg.reactions)}
                        className="hover:scale-125 transition transform text-xl p-1 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Bulle de message cliquable pour ouvrir les émojis */}
                <div 
                  onClick={() => setActiveEmojiPicker(showPicker ? null : msg.id)}
                  className={`rounded-2xl px-4 py-2.5 shadow-sm relative cursor-pointer ${
                    isMe ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                  }`}
                >
                  {!isMe && (
                    <p className="text-[11px] font-bold text-[#0284c7] mb-0.5">
                      {msg.sender}
                    </p>
                  )}

                  {/* Texte */}
                  {msg.content && !msg.content.startsWith('📷') && !msg.content.startsWith('📎') && !msg.content.startsWith('🎤') && (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  )}

                  {/* Image */}
                  {msg.file_type === 'image' && msg.file_url && (
                    <div className="mt-1 mb-1" onClick={(e) => e.stopPropagation()}>
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={msg.file_url} 
                          alt="Média partagé" 
                          className="rounded-lg max-h-60 w-auto object-cover hover:opacity-95 transition shadow-sm" 
                        />
                      </a>
                    </div>
                  )}

                  {/* Document */}
                  {msg.file_type === 'document' && msg.file_url && (
                    <div className="mt-1 mb-1 flex items-center space-x-2 bg-gray-50 p-2 rounded-lg border border-gray-200" onClick={(e) => e.stopPropagation()}>
                      <FileText className="w-8 h-8 text-[#0284c7] shrink-0" />
                      <div className="overflow-hidden flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate">{msg.file_name || 'Document'}</p>
                        <a 
                          href={msg.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#0284c7] hover:underline flex items-center gap-1 font-medium mt-0.5"
                        >
                          <Download className="w-3 h-3" /> Télécharger
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Audio */}
                  {msg.file_type === 'audio' && msg.file_url && (
                    <div className="mt-1 mb-1" onClick={(e) => e.stopPropagation()}>
                      <audio controls src={msg.file_url} className="w-48 sm:w-64 h-10" />
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-1 mt-1">
                    <span className="text-[9px] text-gray-500">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3 text-sky-600" />}
                  </div>

                  {/* Supprimer */}
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMessage(msg.id, msg.sender);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow cursor-pointer hover:bg-red-600 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

              </div>

              {/* Bulles de réactions affichées sous le message (exactement comme WhatsApp) */}
              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'mr-2' : 'ml-2'}`}>
                  {Object.entries(msg.reactions).map(([emoji, users]) => {
                    const hasReacted = fullName ? users.includes(fullName) : false;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji, msg.reactions)}
                        className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs border shadow-sm transition cursor-pointer ${
                          hasReacted 
                            ? 'bg-sky-100 border-sky-300 text-sky-800 font-bold' 
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                        title={users.join(', ')}
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px]">{users.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Barre d'envoi de message */}
      <div className="bg-[#f0f0f0] px-3 py-2.5 flex items-center space-x-2 border-t border-gray-300 shrink-0">
        <div className="flex items-center space-x-1">
          <label className="p-2 text-gray-600 hover:text-[#0284c7] cursor-pointer transition" title="Envoyer une image">
            <ImageIcon className="w-5 h-5" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleFileUpload(e, 'image')} 
              disabled={uploading}
            />
          </label>

          <label className="p-2 text-gray-600 hover:text-[#0284c7] cursor-pointer transition" title="Envoyer un document">
            <FileText className="w-5 h-5" />
            <input 
              type="file" 
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" 
              className="hidden" 
              onChange={(e) => handleFileUpload(e, 'document')} 
              disabled={uploading}
            />
          </label>
        </div>

        <form onSubmit={handleSendMessage} className="flex-1 flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={uploading ? "Envoi en cours..." : "Tapez un message..."}
            disabled={uploading}
            className="flex-1 bg-white px-4 py-2 rounded-full border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0284c7]"
          />

          {newMessage.trim() ? (
            <button
              type="submit"
              disabled={uploading}
              className="bg-[#0284c7] hover:bg-sky-700 text-white p-2.5 rounded-full transition shadow cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2.5 rounded-full transition shadow cursor-pointer ${
                isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un vocal"}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </form>
      </div>

    </div>
  );
}
