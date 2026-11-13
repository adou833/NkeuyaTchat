'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { MessageSquare, Lock, Mail, User, Phone, ShieldAlert, Loader2 } from 'lucide-react';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Calcul de la force du mot de passe (min 6 caractères)
  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0) return { score: 0, label: '', color: 'bg-slate-700' };
    if (pass.length < 6) return { score: 1, label: 'Trop court (6 min)', color: 'bg-red-500' };
    
    let points = 1;
    if (pass.length >= 8) points++;
    if (/[A-Z]/.test(pass)) points++;
    if (/[0-9]/.test(pass)) points++;
    if (/[^A-Za-z0-9]/.test(pass)) points++;

    if (points <= 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' };
    if (points <= 4) return { score: 3, label: 'Fort', color: 'bg-emerald-500' };
    return { score: 4, label: 'Très Fort', color: 'bg-emerald-400' };
  };

  const strength = getPasswordStrength(password);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp && password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom,
            prenom,
            telephone,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        router.push('/');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/');
      }
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#111b21] px-4 py-8 text-white">
      <div className="w-full max-w-md space-y-6 rounded-[28px] bg-white text-gray-900 p-8 shadow-2xl border-[6px] border-[#0284c7] relative overflow-hidden">
        
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0284c7] text-white shadow-md shadow-sky-500/30">
            <MessageSquare className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-gray-800">
            {isSignUp ? 'Rejoindre la Famille Nkeuya' : 'Connexion à NkeuyaTchat'}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {isSignUp ? 'Remplis tes informations pour accéder aux salons' : 'Heureux de te revoir parmi nous !'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-3.5" onSubmit={handleAuth}>
          {isSignUp && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#0284c7] focus:outline-none"
                      placeholder="Jean"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#0284c7] focus:outline-none"
                    placeholder="Nkeuya"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#0284c7] focus:outline-none"
                    placeholder="+237 6XX XX XX XX"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Adresse e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#0284c7] focus:outline-none"
                placeholder="famille@nkeuya.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#0284c7] focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {isSignUp && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.score / 4) * 100}%` }} />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500">Force : <strong className="text-gray-700">{strength.label}</strong></span>
                  <span className={password.length >= 6 ? "text-emerald-600 font-bold" : "text-gray-400"}>6 car. min</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#0284c7] hover:bg-sky-700 transition-colors shadow-md shadow-sky-600/20 disabled:opacity-50 mt-4 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? "S'inscrire et rejoindre" : 'Se connecter'}
          </button>
        </form>

        <div className="text-center text-xs pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-[#0284c7] hover:text-sky-700 font-semibold cursor-pointer"
          >
            {isSignUp ? 'Déjà inscrit ? Se connecter' : 'Nouveau membre ? Créer un compte'}
          </button>
        </div>
      </div>
    </main>
  );
}
