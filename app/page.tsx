'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import {
  MessageCircle,
  User,
  Phone,
  Lock,
  LogOut,
  ShieldCheck,
  Check,
  X,
  Clock,
} from 'lucide-react';

const ADMIN_NAME = 'Eric MABOM';

const SALONS = [
  { id: 'general', name: 'Général', desc: 'Discussions de toute la famille', icon: '💬' },
  { id: 'photos-familiales', name: 'Photos familiales', desc: 'Partage de souvenirs et albums', icon: '📸' },
  { id: 'femmes', name: 'Femmes', desc: 'Espace réservé aux femmes', icon: '👩🏾' },
  { id: 'hommes', name: 'Hommes', desc: 'Espace réservé aux hommes', icon: '👨🏾' },
  { id: 'filles', name: 'Filles', desc: 'Le coin des filles', icon: '👧🏾' },
  { id: 'garcons', name: 'Garçons', desc: 'Le coin des garçons', icon: '👦🏾' },
  { id: 'petits-fils-et-filles', name: 'Petits-fils et filles', desc: 'La nouvelle génération', icon: '👶🏾' },
];

interface PendingUser {
  id: string;
  full_name: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'valide' | 'en_attente' | 'refuse';
  created_at: string;
}

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);

  const fetchPendingUsers = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .in('status', ['pending', 'en_attente'])
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      setPendingUsers(data);
    }
  }, []);

  useEffect(() => {
    const savedUser =
      typeof window !== 'undefined' ? window.localStorage.getItem('chat_user') : null;
    if (savedUser) {
      setCurrentUser(savedUser);
      if (savedUser.toLowerCase() === ADMIN_NAME.toLowerCase()) {
        void fetchPendingUsers();
      }
      router.replace('/salon/general');
    }
  }, [router, fetchPendingUsers]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (
      !lastName.trim() ||
      !firstName.trim() ||
      !phone.trim() ||
      !registerPassword.trim() ||
      !confirmPassword.trim()
    ) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (registerPassword.trim() !== confirmPassword.trim()) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim().toUpperCase()}`;

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .or(`full_name.ilike.${fullName},phone.eq.${phone.trim()}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        setError('Un compte existe déjà avec ce nom ou ce numéro de téléphone.');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('users').insert([
        {
          full_name: fullName,
          phone: phone.trim(),
          password: registerPassword.trim(),
          status: 'pending',
          allowed_salons: SALONS.map((s) => s.id),
        },
      ]);

      if (insertError) {
        setError("Erreur lors de l'enregistrement : " + insertError.message);
      } else {
        setSuccessMsg(
          "Votre compte a été créé ! Votre demande d'accès a été envoyée à l'administrateur pour validation."
        );
        setLastName('');
        setFirstName('');
        setPhone('');
        setRegisterPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError('Une erreur est survenue : ' + message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedName = loginName.trim();
    const trimmedPassword = loginPassword.trim();

    if (!trimmedName || !trimmedPassword) {
      setError('Veuillez entrer votre Prénom et Nom ainsi que votre mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await supabase
        .from('users')
        .select('*')
        .ilike('full_name', trimmedName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (trimmedName.toLowerCase() === ADMIN_NAME.toLowerCase() && !data) {
        window.localStorage.setItem('chat_user', ADMIN_NAME);
        setCurrentUser(ADMIN_NAME);
        void fetchPendingUsers();
        router.replace('/salon/general');
        setLoading(false);
        return;
      }

      if (loginError || !data) {
        setError("Aucun compte trouvé à ce nom. Veuillez d'abord créer votre compte.");
        setLoading(false);
        return;
      }

      const storedPassword =
        typeof data.password === 'string' ? data.password.trim() : '';

      if (storedPassword && storedPassword !== trimmedPassword) {
        setError('Mot de passe incorrect.');
        setLoading(false);
        return;
      }

      const isWaiting =
        data.status === 'pending' || data.status === 'en_attente';
      if (isWaiting && trimmedName.toLowerCase() !== ADMIN_NAME.toLowerCase()) {
        setError(
          "Votre demande d'accès est toujours en attente de validation par l'administrateur."
        );
        setLoading(false);
        return;
      }

      if (data.status === 'rejected' || data.status === 'refuse') {
        setError("Votre demande d'accès a été refusée.");
        setLoading(false);
        return;
      }

      const resolvedName = data.full_name?.trim() || trimmedName;
      window.localStorage.setItem('chat_user', resolvedName);
      setCurrentUser(resolvedName);

      if (resolvedName.toLowerCase() === ADMIN_NAME.toLowerCase()) {
        void fetchPendingUsers();
      }
      router.replace('/salon/general');
    } catch {
      setError('Impossible de vérifier le compte pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    const { error: approveError } = await supabase
      .from('users')
      .update({ status: 'approved' })
      .eq('id', userId);

    if (!approveError) {
      void fetchPendingUsers();
    } else {
      alert('Erreur lors de la validation : ' + approveError.message);
    }
  };

  const handleRejectUser = async (userId: string) => {
    const { error: rejectError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (!rejectError) {
      void fetchPendingUsers();
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('chat_user');
    setCurrentUser(null);
    setLoginName('');
    setLoginPassword('');
  };

  const isAdmin = currentUser?.toLowerCase() === ADMIN_NAME.toLowerCase();

  return (
    <main className="h-[100dvh] w-screen flex justify-center items-center bg-[#dadbd4] overflow-hidden">
      <div className="w-full h-full sm:max-w-md sm:h-[92vh] sm:rounded-3xl sm:shadow-2xl flex flex-col bg-[#efeae2] overflow-hidden border border-gray-300">
        <header className="bg-[#0284c7] text-white px-5 py-4 flex items-center justify-between shadow-md shrink-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide">NkeuyaTchat</h1>
              <p className="text-xs text-sky-100">Salon Général</p>
            </div>
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-full bg-sky-700/60 hover:bg-sky-800 transition cursor-pointer flex items-center gap-1 text-xs"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </header>

        {currentUser && (
          <div className="bg-[#f0f2f5] border-b border-gray-300 py-3 px-3 shrink-0 overflow-x-auto flex space-x-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {SALONS.map((salon) => (
              <Link
                key={salon.id}
                href={`/salon/${salon.id}`}
                className="flex flex-col items-center shrink-0 group cursor-pointer w-16"
              >
                <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-gray-200 flex items-center justify-center text-xl group-hover:border-[#0284c7] group-hover:scale-105 transition">
                  {salon.icon}
                </div>
                <span className="text-[10px] text-gray-700 font-medium text-center mt-1 truncate w-full group-hover:text-[#0284c7]">
                  {salon.name}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-center">
          {!currentUser ? (
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md space-y-4 my-auto">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-[#0284c7] shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-[#0284c7] shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Créer son compte
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-200 text-center font-medium">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200 text-center font-medium">
                  {successMsg}
                </div>
              )}

              {mode === 'register' ? (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="text-center pb-0.5">
                    <h2 className="text-base font-extrabold text-[#0284c7] uppercase tracking-wider">
                      CRÉER SON COMPTE
                    </h2>
                    <p className="text-[11px] text-gray-500">
                      Renseignez vos informations pour demander l&apos;accès
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Le Nom
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Votre nom de famille"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Prénom
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Votre prénom"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Le Numéro de téléphone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ex: +237 6XX XX XX XX"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="Créez votre mot de passe"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Répétez votre mot de passe"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0284c7] hover:bg-sky-700 text-white font-semibold py-3 rounded-xl shadow transition cursor-pointer text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    <span>{loading ? 'Envoi en cours...' : "Demander l'accès"}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="text-center pb-1">
                    <h2 className="text-base font-bold text-gray-800">
                      Accès au salon Général
                    </h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Connectez-vous pour ouvrir le salon Général
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Prénom et Nom
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder="Ex: Eric MABOM"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0284c7]"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0284c7] hover:bg-sky-700 text-white font-semibold py-3.5 rounded-xl shadow transition cursor-pointer text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    <span>{loading ? 'Vérification...' : 'Connexion'}</span>
                  </button>
                </form>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Accès direct au salon Général</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col justify-start">
              <div className="bg-white/90 px-5 py-4 rounded-2xl shadow-xs flex items-center justify-between border border-gray-200/60">
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
                    Membre connecté
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    {currentUser} {isAdmin && '👑'}
                  </p>
                </div>
                <Link
                  href="/salon/general"
                  className="text-xs bg-[#0284c7] text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs hover:bg-sky-700 transition"
                >
                  Salon Général →
                </Link>
              </div>

              {isAdmin && pendingUsers.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Demandes à valider ({pendingUsers.length})
                    </h3>
                  </div>

                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {pendingUsers.map((u) => (
                      <div
                        key={u.id}
                        className="bg-white p-3 rounded-xl shadow-xs flex items-center justify-between border border-amber-100"
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-800">{u.full_name}</p>
                          {u.phone && (
                            <p className="text-[11px] text-gray-500">{u.phone}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleApproveUser(u.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg shadow cursor-pointer transition"
                            title="Valider l'accès"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectUser(u.id)}
                            className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow cursor-pointer transition"
                            title="Refuser"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white/90 rounded-2xl border border-gray-200/70 p-3 space-y-2">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1">
                  Salons de discussion
                </h3>
                <div className="space-y-1.5">
                  {SALONS.map((salon) => (
                    <Link
                      key={salon.id}
                      href={`/salon/${salon.id}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-sky-50 border border-gray-200/70 hover:border-[#0284c7] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{salon.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {salon.name}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {salon.desc}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#0284c7] shrink-0 ml-2">
                        Ouvrir →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}