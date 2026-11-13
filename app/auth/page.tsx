'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // États de Connexion
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // États d'Inscription
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [status, setStatus] = useState<'idle' | 'en_attente' | 'refuse'>('idle');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const ADMIN_NAME = "Eric MABOM";
  const OFFICIAL_SALONS = ['general', 'femmes', 'hommes', 'filles', 'garcons', 'petits-fils-et-filles'];

  // Redirection automatique et écoute Realtime de la validation
  useEffect(() => {
    const savedUser = localStorage.getItem('chat_user');
    if (!savedUser) return;

    if (savedUser.toLowerCase() === ADMIN_NAME.toLowerCase()) {
      localStorage.setItem('chat_salons', JSON.stringify(OFFICIAL_SALONS));
      router.push('/salon/general');
      return;
    }

    // Vérification initiale du statut
    supabase
      .from('users')
      .select('status, salons')
      .eq('full_name', savedUser)
      .single()
      .then(({ data }) => {
        if (data && data.status === 'valide') {
          localStorage.setItem('chat_salons', JSON.stringify(data.salons || ['general']));
          router.push('/salon/general');
        } else if (data && data.status === 'en_attente') {
          setStatus('en_attente');
        } else if (data && data.status === 'refuse') {
          setStatus('refuse');
        }
      });

    // Écoute en temps réel de la validation du compte par l'administrateur
    const channel = supabase
      .channel(`user-status-${savedUser}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `full_name=eq.${savedUser}`,
        },
        (payload) => {
          const updatedUser = payload.new as { status: string; salons: string[] };
          if (updatedUser.status === 'valide') {
            localStorage.setItem('chat_salons', JSON.stringify(updatedUser.salons || ['general']));
            router.push('/salon/general');
          } else if (updatedUser.status === 'refuse') {
            setStatus('refuse');
          } else if (updatedUser.status === 'en_attente') {
            setStatus('en_attente');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Inscription
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !telephone.trim() || !password.trim() || loading) return;

    if (password !== confirmPassword) {
      alert("Les mots de passe ne correspondent pas. Veuillez vérifier.");
      return;
    }

    setLoading(true);
    const fullNameClean = `${prenom.trim()} ${nom.trim()}`;
    const cleanPassword = String(password.trim());

    try {
      // Compte Admin automatique
      if (fullNameClean.toLowerCase() === ADMIN_NAME.toLowerCase()) {
        localStorage.setItem('chat_user', fullNameClean);
        localStorage.setItem('chat_salons', JSON.stringify(OFFICIAL_SALONS));
        
        await supabase.from('users').upsert([
          { 
            full_name: fullNameClean, 
            status: 'valide', 
            salons: OFFICIAL_SALONS,
            password: cleanPassword
          }
        ], { onConflict: 'full_name' });

        router.push('/salon/general');
        return;
      }

      // Vérifier si le membre existe déjà
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('full_name', fullNameClean)
        .single();

      if (existingUser) {
        alert("Ce nom existe déjà. Veuillez utiliser 'Se Connecter'.");
        setLoading(false);
        return;
      }

      // Insertion sécurisée
      const { error: insertError } = await supabase.from('users').insert([
        {
          full_name: fullNameClean,
          status: 'en_attente',
          salons: ['general'],
          password: cleanPassword,
        },
      ]);

      if (!insertError) {
        localStorage.setItem('chat_user', fullNameClean);
        setStatus('en_attente');
      } else {
        alert("Erreur lors de l'inscription : " + insertError.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Connexion
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPassword.trim() || loading) return;

    setLoading(true);
    const cleanName = loginName.trim();
    const cleanLoginPassword = String(loginPassword.trim());

    try {
      // Authentification Admin
      if (cleanName.toLowerCase() === ADMIN_NAME.toLowerCase()) {
        localStorage.setItem('chat_user', cleanName);
        localStorage.setItem('chat_salons', JSON.stringify(OFFICIAL_SALONS));
        
        await supabase.from('users').upsert([
          { full_name: cleanName, status: 'valide', salons: OFFICIAL_SALONS, password: cleanLoginPassword }
        ], { onConflict: 'full_name' });

        router.push('/salon/general');
        return;
      }

      // Recherche du membre
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('full_name', cleanName)
        .single();

      if (error || !existingUser) {
        alert("Aucun compte trouvé pour ce nom. Veuillez d'abord vous inscrire.");
        setLoading(false);
        return;
      }

      // Vérification du mot de passe
      if (existingUser.password && existingUser.password !== cleanLoginPassword) {
        alert("Mot de passe incorrect.");
        setLoading(false);
        return;
      }

      localStorage.setItem('chat_user', cleanName);

      if (existingUser.status === 'valide') {
        localStorage.setItem('chat_salons', JSON.stringify(existingUser.salons || ['general']));
        router.push('/salon/general');
      } else if (existingUser.status === 'en_attente') {
        setStatus('en_attente');
      } else {
        setStatus('refuse');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-[100dvh] w-screen flex items-center justify-center bg-[#222222] p-0 sm:p-4 overflow-hidden">
      <div className="w-full h-full sm:max-w-md sm:max-h-[950px] bg-[#efeae2] sm:rounded-[38px] shadow-2xl flex flex-col relative overflow-hidden sm:border-4 sm:border-[#0284c7]">
        
        {/* BANDEAU BLEU CLAIR AVEC NKEUYATCHAT À GAUCHE (SANS AUCUN POINT À DROITE) */}
        <header className="w-full bg-[#0284c7] text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xl">👨‍👩‍👧‍👦</span>
            <span className="font-bold text-base tracking-wide">NkeuyaTchat</span>
          </div>
          {/* Espace libre à droite pour le futur profil/réglages */}
          <div className="w-6"></div>
        </header>

        {/* CONTENEUR PRINCIPAL DU FORMULAIRE */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 border border-gray-200 flex flex-col justify-center">
            
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-gray-800">Espace Familial Sécurisé</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Veuillez vous connecter ou vous inscrire</p>
            </div>

            {status === 'en_attente' ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-xl text-center space-y-3">
                <div className="animate-spin w-6 h-6 border-3 border-amber-600 border-t-transparent rounded-full mx-auto"></div>
                <h2 className="font-bold text-sm">En attente de validation</h2>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Votre demande d'accès a bien été transmise à l'administrateur. Dès qu'elle sera validée, vous serez automatiquement connecté.
                </p>
                <button
                  onClick={() => {
                    localStorage.removeItem('chat_user');
                    setStatus('idle');
                  }}
                  className="mt-2 text-xs text-amber-900 underline font-semibold block mx-auto cursor-pointer"
                >
                  Changer de compte / Retour
                </button>
              </div>
            ) : status === 'refuse' ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-center space-y-3">
                <h2 className="font-bold text-sm">Accès Refusé</h2>
                <p className="text-xs">L'administrateur a refusé l'accès pour ce compte.</p>
                <button
                  onClick={() => {
                    localStorage.removeItem('chat_user');
                    setStatus('idle');
                  }}
                  className="mt-2 text-xs bg-red-600 text-white px-4 py-2 rounded-lg font-medium cursor-pointer"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      mode === 'login' ? 'bg-[#0284c7] text-white shadow' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Se Connecter
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      mode === 'register' ? 'bg-[#0284c7] text-white shadow' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    S'inscrire
                  </button>
                </div>

                {mode === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        Votre Prénom et Nom
                      </label>
                      <input
                        type="text"
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder="Ex: Eric MABOM"
                        required
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        Mot de passe
                      </label>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#0284c7] hover:bg-sky-700 text-white font-medium py-2.5 rounded-lg transition shadow-md disabled:opacity-50 text-xs cursor-pointer"
                    >
                      {loading ? 'Connexion...' : 'Se Connecter'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        * Nom
                      </label>
                      <input
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex: nkeuya"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        * Prénom
                      </label>
                      <input
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Ex: Jean"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        * Numéro de téléphone
                      </label>
                      <input
                        type="tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        placeholder="Ex: +237 6XXXXXXXX"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        Adresse mail
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ex: jean@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        * Mot de passe
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Choisissez un mot de passe"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                        * Confirmer le mot de passe
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Répétez votre mot de passe"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-[#0284c7]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#0284c7] hover:bg-sky-700 text-white font-medium py-2.5 rounded-lg transition shadow-md disabled:opacity-50 text-xs cursor-pointer mt-1"
                    >
                      {loading ? 'Envoi...' : "Demande d'accès"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
