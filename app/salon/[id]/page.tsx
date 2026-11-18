'use client';

import React, { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Send,
  Image as ImageIcon,
  ArrowLeft,
  Users,
  Shield,
  Cake,
  X,
  UserCheck,
  Palette,
  ZoomIn,
  Trash2,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Profile {
  id: string;
  email?: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  family_branch: string;
  family_role: string;
  residence?: string;
  birth_date: string;
  avatar_url?: string;
  is_admin?: boolean;
  is_approved?: boolean;
}

interface Message {
  id: string;
  salon_id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  is_system?: boolean;
  profiles?: Profile;
}

interface Salon {
  id: string;
  name: string;
  description?: string;
  is_general?: boolean;
}

type ThemeKey = 'bleu-nkeuya' | 'vert-sombre' | 'sombre-classique';

const THEMES: Record<
  ThemeKey,
  {
    name: string;
    bgMain: string;
    bgHeader: string;
    bgCard: string;
    bubbleOwn: string;
    bubbleOther: string;
    accent: string;
    accentHover: string;
    border: string;
  }
> = {
  'bleu-nkeuya': {
    name: 'Bleu Nkeuya',
    bgMain: 'bg-[#081226]',
    bgHeader: 'bg-[#0d1d3a]/95',
    bgCard: 'bg-[#102447]',
    bubbleOwn: 'bg-sky-600 text-white',
    bubbleOther: 'bg-[#152d57] text-slate-100',
    accent: 'bg-sky-500',
    accentHover: 'hover:bg-sky-400',
    border: 'border-sky-900/60',
  },
  'vert-sombre': {
    name: 'Vert sombre',
    bgMain: 'bg-[#071915]',
    bgHeader: 'bg-[#0c2620]/95',
    bgCard: 'bg-[#103029]',
    bubbleOwn: 'bg-emerald-600 text-white',
    bubbleOther: 'bg-[#153b32] text-slate-100',
    accent: 'bg-emerald-500',
    accentHover: 'hover:bg-emerald-400',
    border: 'border-emerald-900/60',
  },
  'sombre-classique': {
    name: 'Sombre',
    bgMain: 'bg-slate-950',
    bgHeader: 'bg-slate-900/95',
    bgCard: 'bg-slate-900',
    bubbleOwn: 'bg-indigo-600 text-white',
    bubbleOther: 'bg-slate-800 text-slate-100',
    accent: 'bg-indigo-500',
    accentHover: 'hover:bg-indigo-400',
    border: 'border-slate-800',
  },
};

export default function SalonPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#081226] flex items-center justify-center text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            <p className="text-sm text-slate-300">Chargement du salon...</p>
          </div>
        </div>
      }
    >
      <SalonContent params={params} />
    </Suspense>
  );
}

function SalonContent({ params }: PageProps) {
  const resolvedParams = use(params);
  const salonId = resolvedParams.id;
  const router = useRouter();

  const [theme, setTheme] = useState<ThemeKey>('bleu-nkeuya');
  const currentTheme = THEMES[theme];

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Profil obligatoire
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    family_branch: '',
    family_role: '',
    residence: '',
    birth_date: '',
  });

  // Gestion photo (aperçu + plein écran)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Charger le thème sauvegardé
  useEffect(() => {
    const savedTheme = localStorage.getItem('nkeuyatchat-theme') as ThemeKey | null;
    if (savedTheme && THEMES[savedTheme]) {
      setTheme(savedTheme);
    }
  }, []);

  const cycleTheme = () => {
    const keys: ThemeKey[] = ['bleu-nkeuya', 'vert-sombre', 'sombre-classique'];
    const next = keys[(keys.indexOf(theme) + 1) % keys.length];
    setTheme(next);
    localStorage.setItem('nkeuyatchat-theme', next);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialisation session, profil, salon, messages et anniversaires
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push('/');
          return;
        }

        const userId = session.user.id;
        setCurrentUserId(userId);

        // 1. Récupérer le profil utilisateur
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (userProfile) {
          setProfile(userProfile);
          setProfileForm({
            first_name: userProfile.first_name || '',
            last_name: userProfile.last_name || '',
            nickname: userProfile.nickname || '',
            family_branch: userProfile.family_branch || '',
            family_role: userProfile.family_role || '',
            residence: userProfile.residence || '',
            birth_date: userProfile.birth_date || '',
          });

          const isIncomplete =
            !userProfile.first_name?.trim() ||
            !userProfile.last_name?.trim() ||
            !userProfile.family_branch?.trim() ||
            !userProfile.family_role?.trim() ||
            !userProfile.birth_date?.trim();

          if (isIncomplete) {
            setShowProfileModal(true);
          }
        } else {
          setShowProfileModal(true);
        }

        // 2. Récupérer les informations du salon
        const { data: salonData } = await supabase
          .from('salons')
          .select('*')
          .eq('id', salonId)
          .single();

        if (salonData) {
          setSalon(salonData);
        }

        // 3. Charger les messages du salon
        await fetchMessages();

        // 4. Vérification automatique des anniversaires (dans le salon Général)
        if (
          salonData?.is_general ||
          salonData?.name?.toLowerCase().includes('général') ||
          salonData?.name?.toLowerCase().includes('general')
        ) {
          await checkAndPostBirthdays(userId);
        }

        // 5. Abonnement temps réel aux nouveaux messages
        channel = supabase
          .channel(`salon-${salonId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `salon_id=eq.${salonId}`,
            },
            () => {
              fetchMessages();
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Erreur initialisation salon:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [salonId, router]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(*)')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
  };

  // Détection et annonce automatique des anniversaires du jour
  const checkAndPostBirthdays = async (userId: string) => {
    try {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todaySuffix = `-${month}-${day}`;
      const todayIsoDate = today.toISOString().split('T')[0];

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, birth_date');

      if (!allProfiles) return;

      const birthdayMembers = allProfiles.filter(
        (p) => p.birth_date && p.birth_date.endsWith(todaySuffix)
      );

      for (const member of birthdayMembers) {
        const displayName = member.nickname
          ? `${member.first_name} "${member.nickname}" ${member.last_name}`
          : `${member.first_name} ${member.last_name}`;

        const marker = `🎂 Joyeux anniversaire à ${displayName}`;

        const { data: existingToday } = await supabase
          .from('messages')
          .select('id')
          .eq('salon_id', salonId)
          .ilike('content', `${marker}%`)
          .gte('created_at', `${todayIsoDate}T00:00:00.000Z`);

        if (!existingToday || existingToday.length === 0) {
          await supabase.from('messages').insert({
            salon_id: salonId,
            user_id: userId,
            content: `${marker} ! Toute la famille Nkeuya te souhaite une merveilleuse journée remplie de santé et de bonheur ! 🎉🥂`,
            is_system: true,
          });
        }
      }
    } catch (err) {
      console.error('Erreur vérification anniversaires:', err);
    }
  };

  // Sauvegarde du profil obligatoire
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    if (
      !profileForm.first_name.trim() ||
      !profileForm.last_name.trim() ||
      !profileForm.family_branch.trim() ||
      !profileForm.family_role.trim() ||
      !profileForm.birth_date.trim()
    ) {
      alert('Merci de remplir tous les champs obligatoires (*).');
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        id: currentUserId,
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        nickname: profileForm.nickname.trim() || null,
        family_branch: profileForm.family_branch.trim(),
        family_role: profileForm.family_role.trim(),
        residence: profileForm.residence.trim() || null,
        birth_date: profileForm.birth_date,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setShowProfileModal(false);
    } catch (err) {
      console.error('Erreur sauvegarde profil:', err);
      alert('Impossible de sauvegarder le profil. Vérifie ta connexion.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Sélection et compression légère de photo avant envoi
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Envoi d'un message (texte et/ou photo)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImageFile) || !currentUserId || sending) {
      return;
    }

    setSending(true);
    try {
      let uploadedImageUrl: string | null = null;

      if (selectedImageFile) {
        const fileExt = selectedImageFile.name.split('.').pop() || 'jpg';
        const filePath = `${salonId}/${currentUserId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, selectedImageFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);
          uploadedImageUrl = publicUrlData.publicUrl;
        } else {
          console.error('Erreur upload image:', uploadError);
        }
      }

      const { error } = await supabase.from('messages').insert({
        salon_id: salonId,
        user_id: currentUserId,
        content: newMessage.trim(),
        image_url: uploadedImageUrl,
      });

      if (error) throw error;

      setNewMessage('');
      clearSelectedImage();
      await fetchMessages();
    } catch (err) {
      console.error('Erreur envoi message:', err);
      alert("Erreur lors de l'envoi du message.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const formatTime = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${currentTheme.bgMain} flex items-center justify-center text-white`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm text-slate-300">Ouverture du salon familial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${currentTheme.bgMain} text-slate-100`}>
      {/* En-tête fixe */}
      <header
        className={`sticky top-0 z-20 ${currentTheme.bgHeader} backdrop-blur-md border-b ${currentTheme.border} px-4 py-3 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-full hover:bg-white/10 transition shrink-0"
            title="Retour aux salons"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg truncate flex items-center gap-2">
              {salon?.name || 'Salon NkeuyaTchat'}
            </h1>
            {salon?.description && (
              <p className="text-xs text-slate-400 truncate">{salon.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cycleTheme}
            className="p-2 rounded-full hover:bg-white/10 transition text-slate-300"
            title={`Thème : ${currentTheme.name}`}
          >
            <Palette className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowProfileModal(true)}
            className="p-2 rounded-full hover:bg-white/10 transition text-slate-300"
            title="Mon profil familial"
          >
            <UserCheck className="w-5 h-5" />
          </button>
          {profile?.is_admin && (
            <button
              onClick={() => router.push('/admin')}
              className="p-2 rounded-full hover:bg-white/10 transition text-amber-400"
              title="Administration"
            >
              <Shield className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Zone des messages */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3 max-w-4xl w-full mx-auto">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun message dans ce salon pour le moment.</p>
            <p className="text-xs mt-1">Sois le premier à saluer la famille !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === currentUserId;
            const sender = msg.profiles;
            const senderLabel = sender
              ? `${sender.first_name}${sender.nickname ? ` (${sender.nickname})` : ''} • ${sender.family_branch || ''}`
              : 'Membre de la famille';

            if (msg.is_system) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-amber-500/15 border border-amber-400/30 text-amber-200 px-4 py-2.5 rounded-2xl text-xs sm:text-sm max-w-md text-center flex items-center gap-2 shadow">
                    <Cake className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>{msg.content}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {!isOwn && (
                  <span className="text-[11px] text-slate-400 ml-2 mb-0.5">
                    {senderLabel}
                  </span>
                )}

                <div
                  className={`group relative max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                    isOwn
                      ? `${currentTheme.bubbleOwn} rounded-br-sm`
                      : `${currentTheme.bubbleOther} rounded-bl-sm`
                  }`}
                >
                  {msg.image_url && (
                    <div className="relative mb-2 overflow-hidden rounded-xl">
                      <img
                        src={msg.image_url}
                        alt="Photo partagée"
                        onClick={() => setFullscreenImage(msg.image_url!)}
                        className="max-h-72 w-auto object-cover cursor-pointer hover:opacity-95 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setFullscreenImage(msg.image_url!)}
                        className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full text-white"
                        title="Agrandir"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {msg.content && (
                    <p className="text-sm sm:text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span className="text-[10px] opacity-70">
                      {formatTime(msg.created_at)}
                    </span>
                    {(isOwn || profile?.is_admin) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-80 hover:opacity-100 transition text-red-300"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Aperçu de la photo sélectionnée avant envoi */}
      {imagePreviewUrl && (
        <div className={`${currentTheme.bgHeader} border-t ${currentTheme.border} px-4 py-2`}>
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <img
              src={imagePreviewUrl}
              alt="Aperçu"
              className="h-16 w-16 object-cover rounded-xl border border-white/20"
            />
            <div className="flex-1 text-xs text-slate-300">
              Photo prête à être envoyée dans le salon
            </div>
            <button
              type="button"
              onClick={clearSelectedImage}
              className="p-1.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Barre de saisie style WhatsApp */}
      <footer className={`sticky bottom-0 ${currentTheme.bgHeader} border-t ${currentTheme.border} px-3 py-2.5`}>
        <form
          onSubmit={handleSendMessage}
          className="max-w-4xl mx-auto flex items-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 text-slate-200 transition shrink-0"
            title="Envoyer une photo"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message à la famille..."
            className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
          />

          <button
            type="submit"
            disabled={sending || (!newMessage.trim() && !selectedImageFile)}
            className={`p-2.5 rounded-full ${currentTheme.accent} ${currentTheme.accentHover} text-white transition shrink-0 disabled:opacity-40`}
            title="Envoyer"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>

      {/* Visionneuse photo plein écran */}
      {fullscreenImage && (
        <div
          onClick={() => setFullscreenImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fullscreenImage}
            alt="Plein écran"
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Modale de profil familial obligatoire */}
      {showProfileModal && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`${currentTheme.bgCard} border ${currentTheme.border} rounded-2xl max-w-md w-full p-6 shadow-2xl`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Fiche Familiale NkeuyaTchat
              </h2>
              {profile?.first_name && profile?.family_branch && profile?.birth_date && (
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Complète tes informations pour que chaque membre de la famille puisse te reconnaître et souhaiter ton anniversaire.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.first_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, first_name: e.target.value })
                    }
                    className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.last_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, last_name: e.target.value })
                    }
                    className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Surnom familial (optionnel)
                </label>
                <input
                  type="text"
                  value={profileForm.nickname}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, nickname: e.target.value })
                  }
                  placeholder="Ex: Tonton, Papa, Petit frère..."
                  className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Branche familiale *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.family_branch}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, family_branch: e.target.value })
                  }
                  placeholder="Ex: Branche Aînée, Famille Douala..."
                  className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Lien / Rôle dans la famille *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.family_role}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, family_role: e.target.value })
                  }
                  placeholder="Ex: Cousin, Tante, Fils de..."
                  className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Date de naissance *
                  </label>
                  <input
                    type="date"
                    required
                    value={profileForm.birth_date}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, birth_date: e.target.value })
                    }
                    className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Ville / Pays
                  </label>
                  <input
                    type="text"
                    value={profileForm.residence}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, residence: e.target.value })
                    }
                    placeholder="Ex: Yaoundé, Paris..."
                    className="w-full bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-sm ${currentTheme.accent} ${currentTheme.accentHover} text-white transition`}
              >
                {savingProfile ? 'Enregistrement...' : 'Valider ma fiche familiale'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}