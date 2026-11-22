'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

const DEFAULT_SALONS = ['general', 'photos-familiales'];

type UserRecord = Record<string, unknown>;

function readField(row: UserRecord, keys: string[]): string {
  for (const k of keys) {
    if (k in row && row[k] !== null && row[k] !== undefined) {
      return String(row[k]).trim();
    }
  }
  const lowerMap = new Map<string, unknown>();
  for (const [key, val] of Object.entries(row)) {
    lowerMap.set(key.toLowerCase().trim(), val);
  }
  for (const k of keys) {
    const found = lowerMap.get(k.toLowerCase().trim());
    if (found !== null && found !== undefined) {
      return String(found).trim();
    }
  }
  return '';
}

function parseSalonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown[];
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        // repli
      }
    }
    return trimmed
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map((s) => s.replace(/^"+|"+$/g, '').trim())
      .filter(Boolean);
  }
  return [];
}

export default function HomePage() {
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanPass = password.trim();

    if (!cleanName || !cleanPass) {
      setErrorMsg('Veuillez saisir votre prénom / nom et votre mot de passe.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setNotice('');

    try {
      const { data, error } = await supabase.from('users').select('*');

      if (error) {
        setErrorMsg(`Erreur de connexion : ${error.message}`);
        setLoading(false);
        return;
      }

      const rows = Array.isArray(data) ? (data as UserRecord[]) : [];
      const targetLower = cleanName.toLowerCase().replace(/\s+/g, ' ');

      const matched = rows.find((row) => {
        const rowName = readField(row, ['nom_complet', 'full_name'])
          .toLowerCase()
          .replace(/\s+/g, ' ');
        return rowName === targetLower;
      });

      if (!matched) {
        setErrorMsg('Aucun compte trouvé à ce nom. Veuillez d’abord créer votre compte.');
        setLoading(false);
        return;
      }

      const rowStatus = readField(matched, ['statut', 'status']).toLowerCase();
      if (rowStatus === 'en_attente' || rowStatus === 'pending' || rowStatus === 'en attente') {
        setErrorMsg('Votre demande d’accès est en attente de validation par l’administrateur.');
        setLoading(false);
        return;
      }

      if (rowStatus === 'suspendu' || rowStatus === 'suspended' || rowStatus === 'bloqué') {
        setErrorMsg('Votre compte est suspendu. Contactez l’administrateur.');
        setLoading(false);
        return;
      }

      const storedPassword = readField(matched, ['mot de passe', 'mot_de_passe', 'password']);
      if (storedPassword && storedPassword !== cleanPass) {
        setErrorMsg('Mot de passe incorrect.');
        setLoading(false);
        return;
      }

      const displayName = readField(matched, ['nom_complet', 'full_name']) || cleanName;
      const extraSalons = parseSalonArray(
        matched['salons_autorisés'] ?? matched.allowed_salons ?? matched.salons
      ).filter((id) => !DEFAULT_SALONS.includes(id));
      const allowedSalons = Array.from(new Set([...DEFAULT_SALONS, ...extraSalons]));

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('chat_user', displayName);
        window.localStorage.setItem('nkeuya_user', displayName);
        window.localStorage.setItem('allowed_salons', JSON.stringify(allowedSalons));
      }

      router.push('/salon/general');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMsg(`Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanPass = password.trim();

    if (!cleanName || !cleanPass) {
      setErrorMsg('Veuillez saisir votre prénom / nom et un mot de passe.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setNotice('');

    try {
      const { data: existingRows, error: readErr } = await supabase.from('users').select('*');
      if (readErr) {
        setErrorMsg(`Erreur vérification compte : ${readErr.message}`);
        setLoading(false);
        return;
      }

      const list = Array.isArray(existingRows) ? (existingRows as UserRecord[]) : [];
      const targetLower = cleanName.toLowerCase().replace(/\s+/g, ' ');
      const alreadyExists = list.some((row) => {
        const rowName = readField(row, ['nom_complet', 'full_name'])
          .toLowerCase()
          .replace(/\s+/g, ' ');
        return rowName === targetLower;
      });

      if (alreadyExists) {
        setErrorMsg('Un compte existe déjà avec ce nom.');
        setLoading(false);
        return;
      }

      const payload: Record<string, unknown> = {
        nom_complet: cleanName,
        téléphone: cleanPhone || null,
        'mot de passe': cleanPass,
        statut: 'en_attente',
        salons_autorisés: [],
      };

      let { error: insertErr } = await supabase.from('users').insert([payload]);

      if (
        insertErr &&
        (insertErr.message.includes('schema cache') || insertErr.message.includes('column'))
      ) {
        const fallbackPayload: Record<string, unknown> = {
          nom_complet: cleanName,
          'mot de passe': cleanPass,
          statut: 'en_attente',
          salons_autorisés: [],
        };
        const retry = await supabase.from('users').insert([fallbackPayload]);
        insertErr = retry.error;
      }

      if (insertErr) {
        setErrorMsg(`Erreur demande d’accès : ${insertErr.message}`);
        setLoading(false);
        return;
      }

      setFullName('');
      setPhone('');
      setPassword('');
      setMode('login');
      setNotice(
        'Demande d’accès envoyée. Vous pourrez vous connecter dès validation par l’administrateur.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMsg(`Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#dadbd4] p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-[#0284c7] text-white px-6 py-5 text-center">
          <h1 className="text-xl font-bold">nkeuya-tchat</h1>
          <p className="text-xs text-sky-100 mt-1">Espace familial privé</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setNotice('');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#0284c7] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setNotice('');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#0284c7] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Demande d’accès
            </button>
          </div>

          {notice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl font-medium">
              {notice}
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Prénom / Nom
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex. Jean Michel MABOM"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#0284c7]"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Numéro de téléphone"
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#0284c7]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#0284c7]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? 'Traitement...'
                : mode === 'login'
                ? 'Se connecter'
                : 'Envoyer la demande d’accès'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}