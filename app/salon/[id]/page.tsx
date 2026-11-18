'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  salon: string;
  sender: string;
  content: string;
  created_at: string;
}

interface ManagedMember {
  name: string;
  status: 'valide' | 'en_attente' | 'refuse';
  salons: string[];
  password?: string;
}

const INITIAL_SALONS = [
  { id: 'general', label: 'Général' },
  { id: 'photos-familiales', label: 'Photos familiales' },
  { id: 'femmes', label: 'Femmes' },
  { id: 'hommes', label: 'Hommes' },
  { id: 'filles', label: 'Filles' },
  { id: 'garcons', label: 'Garçons' },
  { id: 'petits-fils-et-filles', label: 'Petits fils et filles' },
];

export default function SalonChatPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const currentSalon = params?.id || 'general';

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [chatTheme, setChatTheme] = useState<'clair' | 'sombre' | 'bleu'>('clair');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // État de la photo en cours de sélection/rognage
  const [selectedImageFile, setSelectedImageFile] = useState<{ file: File; previewUrl: string; isCropped: boolean } | null>(null);

  // État pour afficher une image seule en plein écran style WhatsApp au clic
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Gestion du profil et admin
  const [showProfile, setShowProfile] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'passwords' | 'salons' | 'en_ligne' | 'moderation'>('users');

  // États du formulaire de profil pour rafraîchir l'affichage en temps réel
  const [profileSurnom, setProfileSurnom] = useState('');
  const [profileTel, setProfileTel] = useState('');
  const [profileVille, setProfileVille] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileAnniversaire, setProfileAnniversaire] = useState('');

  // États du panneau Admin
  const [allSalons, setAllSalons] = useState<{ id: string; label: string }[]>(INITIAL_SALONS);
  const [newSalonName, setNewSalonName] = useState('');
  const [managedMembers, setManagedMembers] = useState<ManagedMember[]>([
    { name: 'eric mabom', status: 'valide', salons: ['general', 'photos-familiales'] },
    { name: 'Eric MABOM', status: 'valide', salons: ['general', 'photos-familiales'] },
  ]);
  const [editingPasswordMember, setEditingPasswordMember] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const ADMIN_PSEUDO = 'adou833';
  const ADMIN_DISPLAY = 'Eric MABOM';
  const isUserAdmin = currentUser.toLowerCase() === ADMIN_PSEUDO.toLowerCase() || currentUser.toLowerCase() === ADMIN_DISPLAY.toLowerCase();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const getSalonLabel = (sId: string) => {
    const found = allSalons.find((s) => s.id === sId);
    if (found) return found.label;
    return sId.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('chat_user') || localStorage.getItem('nkeuya_user');
    if (!storedUser) {
      const pseudo = prompt('Entrez votre nom pour participer au chat :') || 'Membre de la famille';
      localStorage.setItem('chat_user', pseudo);
      setCurrentUser(pseudo);
    } else {
      setCurrentUser(storedUser);
    }

    // Charger les valeurs initiales du profil depuis localStorage
    setProfileSurnom(localStorage.getItem('nkeuya_surnom') || '');
    setProfileTel(localStorage.getItem('nkeuya_tel') || '');
    setProfileVille(localStorage.getItem('nkeuya_ville') || '');
    setProfileRole(localStorage.getItem('nkeuya_role') || '');
    setProfileAnniversaire(localStorage.getItem('nkeuya_anniversaire') || '');

    const savedAvatar = localStorage.getItem('nkeuya_avatar');
    if (savedAvatar) setUserAvatar(savedAvatar);

    const savedTheme = localStorage.getItem('nkeuya_theme') as 'clair' | 'sombre' | 'bleu' | null;
    if (savedTheme) setChatTheme(savedTheme);

    const savedSalons = localStorage.getItem('nkeuya_admin_salons');
    if (savedSalons) {
      try { setAllSalons(JSON.parse(savedSalons)); } catch (e) {}
    }

    const savedMembers = localStorage.getItem('nkeuya_admin_members');
    if (savedMembers) {
      try { setManagedMembers(JSON.parse(savedMembers)); } catch (e) {}
    }
  }, []);

  // VÉRIFICATION DE L'OBLIGATION DE REMPLIR LE PROFIL SI VALIDÉ
  useEffect(() => {
    if (currentUser) {
      const currentMemberData = managedMembers.find(
        (m) => m.name.toLowerCase() === currentUser.toLowerCase()
      );
      if (currentMemberData && currentMemberData.status === 'valide') {
        const surnom = localStorage.getItem('nkeuya_surnom');
        const tel = localStorage.getItem('nkeuya_tel');
        const ville = localStorage.getItem('nkeuya_ville');
        const role = localStorage.getItem('nkeuya_role');
        const anniversaire = localStorage.getItem('nkeuya_anniversaire');

        if (!surnom || !tel || !ville || !role || !anniversaire) {
          setShowProfile(true);
        }
      }
    }
  }, [currentUser, managedMembers]);

  // VÉRIFICATION AUTOMATIQUE DES ANNIVERSAIRES
  useEffect(() => {
    if (currentSalon === 'general' && currentUser) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const todayFormatted = `${day}/${month}`;

      const myBirthday = localStorage.getItem('nkeuya_anniversaire');
      const lastWishedDate = localStorage.getItem('nkeuya_last_birthday_wish');

      if (myBirthday === todayFormatted && lastWishedDate !== todayFormatted) {
        const sendBirthdayMessage = async () => {
          try {
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                salon: 'general',
                sender: '🎉 Système NkeuyaTchat',
                content: `🎂🎈 Joyeux anniversaire à notre cher(e) membre de la famille **${currentUser}** ! Que cette journée t'apporte joie, santé et bonheur ! 🥳🥂`,
              }),
            });
            localStorage.setItem('nkeuya_last_birthday_wish', todayFormatted);
            loadMessages();
          } catch (err) {
            console.error('Erreur anniversaire auto :', err);
          }
        };
        sendBirthdayMessage();
      }
    }
  }, [currentSalon, currentUser]);

  const handleThemeChange = (theme: 'clair' | 'sombre' | 'bleu') => {
    setChatTheme(theme);
    localStorage.setItem('nkeuya_theme', theme);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64Avatar = reader.result as string;
      setUserAvatar(base64Avatar);
      localStorage.setItem('nkeuya_avatar', base64Avatar);
    };
  };

  const persistMembers = (updated: ManagedMember[]) => {
    setManagedMembers(updated);
    localStorage.setItem('nkeuya_admin_members', JSON.stringify(updated));
  };

  const loadMessages = async () => {
    if (!currentSalon) return;
    try {
      const res = await fetch(`/api/messages?salon=${encodeURIComponent(currentSalon)}`);
      if (res.ok) {
        const data: Message[] = await res.json();
        setMessages((prevMessages) => (data.length !== prevMessages.length ? data : prevMessages));
      }
    } catch (err) {
      console.error('Erreur chargement messages :', err);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [currentSalon]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendContent = async (content: string) => {
    const author = currentUser || 'Famille';
    setLoading(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salon: currentSalon, sender: author, content }),
      });
      if (res.ok) {
        setNewMessage('');
        await loadMessages();
      }
    } catch (err) {
      console.error('Erreur réseau :', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await sendContent(newMessage.trim());
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce message ?')) return;
    try {
      const res = await fetch(`/api/messages?id=${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setSelectedImageFile({ file, previewUrl, isCropped: false });
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const fileUrl = reader.result as string;
        let prefix = 'file';
        if (file.type.startsWith('video/')) prefix = 'VIDEO';
        else if (file.type.startsWith('audio/')) prefix = 'AUDIO';
        await sendContent(`[${prefix}]::${file.name}::${fileUrl}`);
      };
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmSendPhoto = () => {
    if (!selectedImageFile) return;
    const { file, previewUrl, isCropped } = selectedImageFile;

    if (!isCropped) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        await sendContent(`[IMAGE]::${file.name}::${reader.result as string}`);
        setSelectedImageFile(null);
      };
    } else {
      const img = new Image();
      img.src = previewUrl;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 1200, 1200);
        }

        await sendContent(`[IMAGE]::cropped_${file.name}::${canvas.toDataURL('image/jpeg', 0.95)}`);
        setSelectedImageFile(null);
      };
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          await sendContent(`[AUDIO]::Message_vocal_${Date.now()}.webm::${reader.result as string}`);
        };
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
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const containerBgClass =
    chatTheme === 'sombre'
      ? 'bg-[#111b21]'
      : chatTheme === 'bleu'
      ? 'bg-[#0c2340]'
      : 'bg-[#efeae2]';

  const getBubbleClass = (isMe: boolean) => {
    if (chatTheme === 'sombre') return isMe ? 'bg-[#005c4b] text-white' : 'bg-[#202c33] text-gray-100';
    if (chatTheme === 'bleu') return isMe ? 'bg-[#0284c7] text-white' : 'bg-[#1e3a8a] text-gray-100';
    return isMe ? 'bg-[#dcf8c6] text-gray-900' : 'bg-white text-gray-900';
  };

  const renderMessageContent = (msg: Message) => {
    const content = msg.content;
    if (content.startsWith('[IMAGE]::')) {
      const parts = content.split('::');
      const imgUrl = parts[2];
      const imgName = parts[1];

      return (
        <div className="space-y-1">
          <img
            src={imgUrl}
            alt={imgName}
            onClick={() => setLightboxImage({ url: imgUrl, title: imgName })}
            className="rounded-lg max-w-xs max-h-60 object-cover cursor-pointer hover:opacity-95 transition shadow"
            title="Afficher la photo seule"
          />
          <button
            type="button"
            onClick={() => downloadFile(imgUrl, imgName)}
            className="block text-[11px] text-[#0284c7] hover:underline font-semibold cursor-pointer pt-1"
          >
            📥 Télécharger
          </button>
        </div>
      );
    }
    if (content.startsWith('[VIDEO]::')) {
      const parts = content.split('::');
      return (
        <div className="space-y-2">
          <span className="text-xs font-semibold block opacity-80">🎥 {parts[1]}</span>
          <video controls preload="metadata" src={parts[2]} className="rounded max-w-xs max-h-60" />
          <button
            type="button"
            onClick={() => downloadFile(parts[2], parts[1])}
            className="block text-[11px] bg-[#0284c7] text-white px-3 py-1.5 rounded-full hover:bg-[#0369a1] transition font-medium cursor-pointer"
          >
            📥 Télécharger la vidéo
          </button>
        </div>
      );
    }
    if (content.startsWith('[AUDIO]::')) {
      const parts = content.split('::');
      return (
        <div className="flex flex-col gap-2 py-1">
          <span className="text-xs font-bold">🎤 Message vocal</span>
          <audio controls preload="none" src={parts[2]} className="w-full max-w-xs h-9" />
          <button
            type="button"
            onClick={() => downloadFile(parts[2], parts[1])}
            className="block text-[11px] bg-[#0284c7] text-white px-3 py-1.5 rounded-full hover:bg-[#0369a1] transition font-medium w-fit cursor-pointer"
          >
            📥 Télécharger le vocal
          </button>
        </div>
      );
    }
    if (content.startsWith('[file]::')) {
      const parts = content.split('::');
      return (
        <div className="space-y-2 py-1">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <span className="text-xl">📄</span>
            <span className="text-xs font-bold text-gray-800 break-all">{parts[1]}</span>
          </div>
          <button
            type="button"
            onClick={() => downloadFile(parts[2], parts[1])}
            className="block text-[11px] bg-[#0284c7] text-white px-3 py-1.5 rounded-full hover:bg-[#0369a1] transition font-medium cursor-pointer"
          >
            📥 Télécharger le document
          </button>
        </div>
      );
    }
    return <p className="break-words">{content}</p>;
  };

  // Vérification dynamique si toutes les infos obligatoires sont remplies
  const isProfileComplete = Boolean(
    currentUser.trim() &&
    profileSurnom.trim() &&
    profileTel.trim() &&
    profileVille.trim() &&
    profileRole.trim() &&
    profileAnniversaire.trim()
  );

  return (
    <div className={`flex flex-col h-screen ${containerBgClass} relative transition-colors duration-200`}>
      <header className="bg-[#0284c7] text-white p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-white text-xs sm:text-sm font-semibold bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 transition cursor-pointer"
          >
            ← Accueil Salons
          </button>
          <h1 className="text-base sm:text-lg font-bold capitalize">Salon : {getSalonLabel(currentSalon)}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-sky-900/50 p-1 rounded-lg flex items-center gap-1 border border-sky-400/30">
            {(['clair', 'sombre', 'bleu'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleThemeChange(t)}
                className={`text-[11px] px-2 py-1 rounded font-bold capitalize transition cursor-pointer ${
                  chatTheme === t ? 'bg-white text-[#0284c7] shadow' : 'text-sky-100 hover:bg-sky-800'
                }`}
              >
                {t === 'clair' ? '☀️' : t === 'sombre' ? '🌙' : '🔵'} {t}
              </button>
            ))}
          </div>

          {isUserAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold px-3 py-1.5 rounded-full transition shadow cursor-pointer"
            >
              {showAdminPanel ? '💬 Aller au Chat' : '⚙️ Panneau Admin'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 text-[11px] sm:text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full font-semibold transition cursor-pointer"
          >
            {userAvatar ? (
              <img src={userAvatar} alt="Avatar" className="w-5 h-5 rounded-full object-cover border border-white" />
            ) : (
              <span>👤</span>
            )}
            <span>Mon Profil</span>
          </button>
        </div>
      </header>

      {/* MODE LIGHTBOX STYLE WHATSAPP : PHOTO SEULE SUR FOND NOIR PUR */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between items-center select-none">
          <div className="w-full flex justify-end p-4 z-10">
            <button
              onClick={() => setLightboxImage(null)}
              className="text-white bg-black/50 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold transition cursor-pointer"
              title="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 w-full max-w-5xl overflow-hidden">
            <img
              src={lightboxImage.url}
              alt="Vue unique"
              className="max-h-[82vh] max-w-[92vw] object-contain shadow-2xl transition-transform duration-200"
            />
          </div>

          <div className="w-full flex justify-center pb-6 pt-2 z-10">
            <button
              type="button"
              onClick={() => downloadFile(lightboxImage.url, lightboxImage.title)}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-xs font-medium transition backdrop-blur-md cursor-pointer flex items-center gap-2 border border-white/10"
            >
              <span>📥 Télécharger la photo</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉVISUALISATION AVANT ENVOI */}
      {selectedImageFile && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-between p-4">
          <div className="w-full flex justify-between items-center text-white">
            <span className="font-bold text-sm">Aperçu et réglage de la photo</span>
            <button
              onClick={() => setSelectedImageFile(null)}
              className="text-gray-300 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 w-full">
            <div className={`flex items-center justify-center transition-all duration-300 ${
              selectedImageFile.isCropped ? 'w-72 h-72 bg-black border-2 border-white/40 rounded-2xl overflow-hidden shadow-2xl' : 'max-h-[65vh] max-w-full'
            }`}>
              <img
                key={selectedImageFile.isCropped ? 'cropped' : 'full'}
                src={selectedImageFile.previewUrl}
                alt="Aperçu"
                className={`transition-all duration-300 ${
                  selectedImageFile.isCropped ? 'w-full h-full object-cover' : 'max-h-[65vh] max-w-full object-contain rounded-lg'
                }`}
              />
            </div>
          </div>

          <div className="w-full max-w-md flex items-center justify-between gap-3 bg-[#111b21] p-3 rounded-2xl border border-gray-700">
            <button
              type="button"
              onClick={() =>
                setSelectedImageFile((prev) => (prev ? { ...prev, isCropped: !prev.isCropped } : null))
              }
              className="flex items-center gap-2 bg-[#202c33] hover:bg-gray-700 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition cursor-pointer border border-gray-600 shadow"
            >
              <span>{selectedImageFile.isCropped ? '🖼️ Vue Entière' : '✂️ Rogner en Carré'}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmSendPhoto}
              disabled={loading}
              className="bg-[#0284c7] hover:bg-sky-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow cursor-pointer"
            >
              {loading ? 'Envoi...' : 'Envoyer la photo ➔'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL PROFIL OBLIGATOIRE (AVEC MESSAGE QUI DISPARAÎT UNE FOIS COMPLÉTÉ) */}
      {showProfile && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-lg font-bold">Mon Espace Personnel</h2>
                {!isProfileComplete && (
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">⚠️ Veuillez remplir les informations obligatoires pour continuer.</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (!isProfileComplete) {
                    alert('Veuillez remplir toutes les informations obligatoires avant de fermer.');
                    return;
                  }
                  setShowProfile(false);
                }}
                className="font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3 bg-sky-50 p-3.5 rounded-xl">
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-[#0284c7]" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#0284c7] text-white flex items-center justify-center text-xl font-bold">
                  {currentUser ? currentUser.charAt(0).toUpperCase() : 'N'}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-[#0284c7]">{currentUser}</p>
                <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                <button type="button" onClick={() => avatarInputRef.current?.click()} className="text-xs bg-[#0284c7] text-white px-3 py-1.5 rounded font-semibold mt-2 cursor-pointer">
                  📷 Changer ma photo
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">1. Nom complet / Prénom et Nom <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={currentUser}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrentUser(val);
                    localStorage.setItem('chat_user', val);
                  }}
                  placeholder="Ex: Eric Mabom"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">2. Surnom / Petit nom de famille <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={profileSurnom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileSurnom(val);
                    localStorage.setItem('nkeuya_surnom', val);
                  }}
                  placeholder="Ex: Tonton ou petit nom..."
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">3. Numéro de téléphone / Joignable <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={profileTel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileTel(val);
                    localStorage.setItem('nkeuya_tel', val);
                  }}
                  placeholder="Ex: +237 6XXXXXXXX"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">4. Ville / Pays de résidence <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={profileVille}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileVille(val);
                    localStorage.setItem('nkeuya_ville', val);
                  }}
                  placeholder="Ex: Yaoundé, Cameroun"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">5. Rôle dans la famille <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileRole(val);
                    localStorage.setItem('nkeuya_role', val);
                  }}
                  placeholder="Ex: Père, Mère, Fils, Fille..."
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0284c7] mb-1">🎂 6. Date d'anniversaire (Jour / Mois) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={profileAnniversaire}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileAnniversaire(val);
                    localStorage.setItem('nkeuya_anniversaire', val);
                  }}
                  placeholder="Ex: 14/03"
                  required
                  className="w-full bg-sky-50 border border-sky-200 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              {/* NON OBLIGATOIRE */}
              <div>
                <label className="block font-bold text-gray-500 mb-1">7. Lien de parenté / Branche familiale <span className="text-xs font-normal text-gray-400">(Optionnel)</span></label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem('nkeuya_branche') || ''}
                  onBlur={(e) => localStorage.setItem('nkeuya_branche', e.target.value.trim())}
                  placeholder="Ex: Branche Grand-Père Jean"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800 font-medium focus:outline-none focus:border-[#0284c7]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!isProfileComplete) {
                    alert('Veuillez remplir toutes les informations obligatoires avant d\'enregistrer.');
                    return;
                  }
                  setShowProfile(false);
                }}
                className="bg-[#0284c7] hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                Enregistrer et fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANNEAU ADMIN OU CHAT */}
      {isUserAdmin && showAdminPanel ? (
        <div className="flex-1 bg-[#111b21] text-white overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-sky-900 pb-3">
            <h2 className="text-base font-bold text-sky-400">⚙️ Gestion et Panneau Administrateur</h2>
            <button
              type="button"
              onClick={() => setShowAdminPanel(false)}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
            >
              💬 Revenir au Chat
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-sky-900 pb-2">
            {[
              { id: 'users', label: '👥 Membres et Validations' },
              { id: 'passwords', label: '🔑 Mots de passe' },
              { id: 'salons', label: '💬 Gestion des Salons' },
              { id: 'en_ligne', label: '🟢 En ligne' },
              { id: 'moderation', label: '🛡️ Modération' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id as any)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                  adminTab === tab.id ? 'bg-[#0284c7] text-white shadow' : 'bg-[#1e293b] text-gray-300 hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1. MEMBRES */}
          {adminTab === 'users' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-sky-400 uppercase">Gestion des Membres</h3>
              {managedMembers.map((member) => (
                <div key={member.name} className="bg-[#1e293b] p-3.5 rounded-xl border border-sky-900 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{member.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${member.status === 'valide' ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
                        {member.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => persistMembers(managedMembers.filter((m) => m.name !== member.name))}
                      className="text-xs bg-red-950 text-red-300 px-2.5 py-1 rounded-lg border border-red-800 font-bold cursor-pointer"
                    >
                      🗑️ Suppr.
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {member.status !== 'valide' && (
                      <button
                        type="button"
                        onClick={() => persistMembers(managedMembers.map((m) => m.name === member.name ? { ...m, status: 'valide' } : m))}
                        className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-bold cursor-pointer"
                      >
                        ✅ Valider
                      </button>
                    )}
                    {member.status !== 'refuse' && (
                      <button
                        type="button"
                        onClick={() => persistMembers(managedMembers.map((m) => m.name === member.name ? { ...m, status: 'refuse' } : m))}
                        className="bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold cursor-pointer"
                      >
                        ❌ Bloquer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. MOTS DE PASSE */}
          {adminTab === 'passwords' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-sky-400 uppercase">Gestion des Mots de passe</h3>
              {managedMembers.map((member) => (
                <div key={member.name} className="bg-[#1e293b] p-3 rounded-xl border border-sky-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{member.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPasswordMember(editingPasswordMember === member.name ? null : member.name);
                        setNewPasswordInput('');
                      }}
                      className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      {editingPasswordMember === member.name ? 'Annuler' : '🔑 Modifier'}
                    </button>
                  </div>
                  {editingPasswordMember === member.name && (
                    <div className="flex gap-2 pt-2 border-t border-sky-900">
                      <input
                        type="text"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        className="flex-1 bg-[#111b21] border border-sky-800 rounded px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newPasswordInput.trim()) return;
                          persistMembers(managedMembers.map((m) => m.name === member.name ? { ...m, password: newPasswordInput.trim() } : m));
                          setEditingPasswordMember(null);
                          setNewPasswordInput('');
                          alert('Mot de passe mis à jour !');
                        }}
                        className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-bold cursor-pointer"
                      >
                        Enregistrer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 3. SALONS */}
          {adminTab === 'salons' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-sky-400 uppercase">Gestion et Liste des Salons</h3>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="bg-sky-700 hover:bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                >
                  🏠 Retourner à l'ensemble des salons
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newSalonName.trim();
                  if (!label) return;
                  const id = label.toLowerCase().replace(/\s+/g, '-');
                  if (allSalons.some((s) => s.id === id)) {
                    alert('Ce salon existe déjà !');
                    return;
                  }
                  const updated = [...allSalons, { id, label }];
                  setAllSalons(updated);
                  localStorage.setItem('nkeuya_admin_salons', JSON.stringify(updated));
                  setNewSalonName('');
                }}
                className="bg-[#1e293b] p-3.5 rounded-xl border border-sky-900 space-y-2"
              >
                <h4 className="text-xs font-bold text-gray-300">➕ Créer un nouveau salon</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSalonName}
                    onChange={(e) => setNewSalonName(e.target.value)}
                    placeholder="Nom du salon..."
                    required
                    className="flex-1 bg-[#111b21] border border-sky-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-4 py-1.5 rounded-lg font-bold cursor-pointer">
                    Ajouter
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-300">Salons Actuels ({allSalons.length})</h4>
                {allSalons.map((salon) => (
                  <div key={salon.id} className="bg-[#1e293b] p-3 rounded-xl border border-sky-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">💬 {salon.label}</span>
                      <span className="text-[10px] text-gray-400">({salon.id})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/salon/${salon.id}`)}
                        className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-2.5 py-1 rounded font-bold cursor-pointer"
                      >
                        ➡️ Rejoindre
                      </button>
                      {salon.id !== 'general' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Voulez-vous vraiment supprimer le salon "${salon.label}" ?`)) return;
                            const updated = allSalons.filter((s) => s.id !== salon.id);
                            setAllSalons(updated);
                            localStorage.setItem('nkeuya_admin_salons', JSON.stringify(updated));
                            if (currentSalon === salon.id) {
                              router.push('/salon/general');
                            }
                          }}
                          className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 text-xs px-2.5 py-1 rounded font-bold cursor-pointer"
                        >
                          🗑️ Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. EN LIGNE */}
          {adminTab === 'en_ligne' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-sky-400 uppercase">Membres connectés</h3>
              {Array.from(new Set([currentUser, ...messages.map((m) => m.sender)].filter(Boolean))).map((name) => (
                <div key={name} className="bg-[#1e293b] p-3 rounded-lg border border-sky-900 text-sm font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          )}

          {/* 5. MODÉRATION */}
          {adminTab === 'moderation' && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-sky-400 uppercase">Modération des Messages</h3>
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="bg-[#1e293b] p-3 rounded-lg border border-sky-900 space-y-1 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-sky-400">{m.sender}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(m.id)}
                        className="bg-red-950 text-red-300 border border-red-800 px-2 py-1 rounded font-bold cursor-pointer"
                      >
                        🗑️ Suppr.
                      </button>
                    </div>
                    <p className="text-gray-200 break-all">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* LISTE MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {messages.length === 0 ? (
              <div className="text-center opacity-60 mt-10 text-sm">Aucun message dans ce salon.</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender === currentUser;
                return (
                  <div key={msg.id} className="flex items-start gap-2.5 relative group">
                    {isMe && userAvatar ? (
                      <img src={userAvatar} alt={msg.sender} className="w-8 h-8 rounded-full object-cover border border-[#0284c7] shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#0284c7] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {msg.sender ? msg.sender.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm text-sm rounded-tl-none ${getBubbleClass(isMe)}`}>
                      <div className="flex items-center justify-between gap-4 mb-0.5">
                        <span className="text-[10px] font-bold text-[#0284c7]">{msg.sender}</span>
                        {(isMe || isUserAdmin) && (
                          <button type="button" onClick={() => handleDeleteMessage(msg.id)} className="text-red-500 text-xs font-bold px-1 cursor-pointer">
                            🗑️
                          </button>
                        )}
                      </div>
                      {renderMessageContent(msg)}
                      <span className="block text-[9px] text-right opacity-60 mt-1">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* FORMULAIRE D'ENVOI */}
          <form onSubmit={handleSendMessage} className="bg-[#f0f2f5] p-3 flex items-center gap-2 border-t border-gray-300">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-600 hover:text-[#0284c7] rounded-full hover:bg-gray-200 cursor-pointer" title="Envoyer un fichier ou photo">
              📎
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isRecording ? 'Enregistrement vocal...' : 'Tapez un message...'}
              disabled={isRecording}
              className="flex-1 bg-white px-4 py-2.5 rounded-full border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0284c7] text-gray-800"
            />
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-2.5 rounded-full text-white cursor-pointer ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500 hover:bg-gray-600'}`}
              title="Maintenir pour enregistrer un vocal"
            >
              🎤
            </button>
            <button type="submit" disabled={loading || !newMessage.trim()} className="bg-[#0284c7] text-white px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50">
              {loading ? '...' : 'Envoyer'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}