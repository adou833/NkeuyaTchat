'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import {
  MessageCircle,
  User,
  Phone,
  Lock,
  ShieldCheck,
} from 'lucide-react';

const SALON_IDS = [
  'general',
  'photos-familiales',
  'femmes',
  'hommes',
  'filles',
  'garcons',
  'petits-fils-et-filles',
];

interface UserRow {
  id: string;
  full_name: string | null;
  phone?: string | null;
  password?: string | null;
  status: string | null;
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

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const warmUpAdminData = useCallback(async () => {
    await supabase
      .from('users')
      .select('id')
      .in('status', ['pending', 'en_attente'])
      .limit(1);
  }, []);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
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
        .select('id')
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
          allowed_salons: SALON_IDS,
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedName = loginName.trim();
    const trimmedPassword = loginPassword.trim();
    const isEricMabom = trimmedName.toLowerCase() === 'eric mabom';

    if (!trimmedName) {
      setError('Veuillez entrer votre Prénom et Nom.');
      return;
    }

    if (isEricMabom) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('chat_user', trimmedName);
      }
      void warmUpAdminData();
      router.replace('/salon/general');
      return;
    }

    if (!trimmedPassword) {
      setError('Veuillez entrer votre mot de passe.');
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

      const row = (data ?? null) as UserRow | null;

      if (loginError || !row) {
        setError("Aucun compte trouvé à ce nom. Veuillez d'abord créer votre compte.");
        setLoading(false);
        return;
      }

      const storedPassword =
        typeof row.password === 'string' ? row.password.trim() : '';

      if (storedPassword && storedPassword !== trimmedPassword) {
        setError('Mot de passe incorrect.');
        setLoading(false);
        return;
      }

      if (row.status === 'pending' || row.status === 'en_attente') {
        setError(
          "Votre demande d'accès est toujours en attente de validation par l'administrateur."
        );
        setLoading(false);
        return;
      }

      if (row.status === 'rejected' || row.status === 'refuse') {
        setError("Votre demande d'accès a été refusée.");
        setLoading(false);
        return;
      }

      const resolvedName =
        row.full_name && row.full_name.trim() ? row.full_name.trim() : trimmedName;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('chat_user', resolvedName);
      }
      router.replace('/salon/general');
    } catch {
      setError('Impossible de vérifier le compte pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  const isTypingAdmin = loginName.trim().toLowerCase() === 'eric mabom';

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
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-center">
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
                      required={!isTypingAdmin}
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
        </div>
      </div>
    </main>
  );
}