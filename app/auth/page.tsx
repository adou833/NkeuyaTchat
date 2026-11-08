'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { MessageSquare, Lock, Mail, User, Phone, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

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
      const { data, error: signUpError } = await supabase.auth.signUp({
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-slate-900 p-8 shadow-2xl border border-slate-800">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <MessageSquare className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {isSignUp ? 'Rejoindre la Famille Nkeuya' : 'Connexion à NkeuyaTchat'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isSignUp ? 'Remplis tes informations pour accéder aux salons' : 'Heureux de te revoir parmi nous !'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleAuth}>
          {isSignUp && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Jean"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Nkeuya"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="+237 6XX XX XX XX"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Adresse e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="famille@nkeuya.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {isSignUp && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.score / 4) * 100}%` }} />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">Force : <strong className="text-white">{strength.label}</strong></span>
                  <span className={password.length >= 6 ? "text-emerald-400" : "text-slate-500"}>6 car. min</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isSignUp ? "S'inscrire et rejoindre" : 'Se connecter'}
          </button>
        </form>

        <div className="text-center text-xs">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-indigo-400 hover:text-indigo-300 font-medium"
          >
            {isSignUp ? 'Déjà inscrit ? Connexion' : 'Nouveau membre ? Créer un compte'}
          </button>
        </div>
      </div>
    </main>
  );
}