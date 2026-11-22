'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const SALONS = [
  { id: 'general', name: 'Général', icon: '💬' },
  { id: 'photos-familiales', name: 'Photos familiales', icon: '📸' },
  { id: 'femmes', name: 'Femmes', icon: '👩🏾' },
  { id: 'hommes', name: 'Hommes', icon: '👨🏾' },
  { id: 'filles', name: 'Filles', icon: '👧🏾' },
  { id: 'garcons', name: 'Garçons', icon: '👦🏾' },
  { id: 'petits-fils-et-filles', name: 'Petits-fils et filles', icon: '👶🏾' },
];

const DEFAULT_SALONS = ['general', 'photos-familiales'];
const EXTRA_SALONS = SALONS.filter((s) => !DEFAULT_SALONS.includes(s.id));

type GenericRow = Record<string, unknown>;

interface UserRow {
  id: string;
  nom_complet?: string | null;
  full_name?: string | null;
  'mot de passe'?: string | null;
  password?: string | null;
  statut?: string | null;
  status?: string | null;
  salons?: string | null;
  salons_autorisés?: string[] | string | null;
  allowed_salons?: string[] | string | null;
  téléphone?: string | null;
  phone?: string | null;
  créé_à?: string | null;
  created_at?: string | null;
}

const TEXT_CANDIDATES = ['contenu', 'message', 'texte', 'content', 'body', 'text'];
const SENDER_CANDIDATES = [
  'expediteur',
  'expéditeur',
  'sender_name',
  'sender',
  'author',
  'auteur',
  'nom_complet',
  'full_name',
];
const DATE_CANDIDATES = ['créer_à', 'cree_a', 'créé_à', 'created_at', 'date'];

function isAdminUser(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().toLowerCase() === 'eric mabom';
}

function pickField(row: GenericRow | null, candidates: string[]): string | null {
  if (!row) return null;
  for (const key of candidates) {
    if (key in row) return key;
  }
  const lowerMap = new Map<string, string>();
  for (const k of Object.keys(row)) {
    lowerMap.set(k.toLowerCase().trim(), k);
  }
  for (const cand of candidates) {
    const found = lowerMap.get(cand.toLowerCase().trim());
    if (found) return found;
  }
  return null;
}

function parseRawSalonList(raw: unknown): string[] {
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
        // repli sur séparation virgule
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

function getExtraAllowedSalons(user: UserRow): string[] {
  const raw = user['salons_autorisés'] ?? user.allowed_salons ?? user.salons;
  const list = parseRawSalonList(raw);
  return Array.from(new Set(list.filter((id) => !DEFAULT_SALONS.includes(id))));
}

function getUserName(user: UserRow): string {
  return (user.nom_complet ?? user.full_name ?? 'Sans nom').trim() || 'Sans nom';
}

function getUserStatus(user: UserRow): string {
  return (user.statut ?? user.status ?? 'non défini').trim() || 'non défini';
}

function getUserPhoneDisplay(user: UserRow): string {
  const val = user['téléphone'] ?? user.phone;
  return typeof val === 'string' && val.trim() ? val.trim() : '—';
}

export default function AdminDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'members' | 'salons' | 'settings'>('messages');

  const [messages, setMessages] = useState<GenericRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [salonFilter, setSalonFilter] = useState<string>('all');

  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newStatus, setNewStatus] = useState('actif');
  const [newExtraSalons, setNewExtraSalons] = useState<string[]>([]);

  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('chat_user');
    if (!isAdminUser(saved)) {
      setAuthorized(false);
      router.replace('/salon/general');
      return;
    }
    setAuthorized(true);
  }, [router]);

  const fetchAllMessages = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select('*');
    if (error) {
      setStatusNotice(`Erreur chargement messages : ${error.message}`);
      return;
    }
    if (Array.isArray(data)) {
      setMessages([...(data as GenericRow[])].reverse());
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      setStatusNotice(`Erreur chargement membres : ${error.message}`);
      return;
    }
    if (Array.isArray(data)) {
      const list = [...(data as UserRow[])].sort((a, b) => {
        const da = a['créé_à'] ?? a.created_at;
        const db = b['créé_à'] ?? b.created_at;
        const ta = da ? new Date(String(da)).getTime() : 0;
        const tb = db ? new Date(String(db)).getTime() : 0;
        return tb - ta;
      });
      setUsers(list);
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      void fetchAllMessages();
      void fetchAllUsers();
    }
  }, [authorized, fetchAllMessages, fetchAllUsers]);

  const handleDeleteMessage = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Supprimer ce message ?')) {
      return;
    }
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) {
      setStatusNotice(`Erreur suppression message : ${error.message}`);
      return;
    }
    setMessages((prev) => prev.filter((m) => String(m.id) !== id));
    setStatusNotice('Message supprimé.');
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFullName.trim();
    if (!cleanName) {
      setStatusNotice('Saisissez le nom complet du membre.');
      return;
    }
    setLoading(true);
    setStatusNotice('');

    const extraList = Array.from(
      new Set(newExtraSalons.filter((id) => !DEFAULT_SALONS.includes(id)))
    );
    const cleanPhone = newPhone.trim() || null;
    const cleanPass = newPassword.trim() || '1234';

    const payloadFr: Record<string, unknown> = {
      nom_complet: cleanName,
      téléphone: cleanPhone,
      'mot de passe': cleanPass,
      statut: newStatus,
      salons_autorisés: extraList,
    };

    let { error } = await supabase.from('users').insert([payloadFr]);

    if (
      error &&
      (error.message.includes('schema cache') || error.message.includes('column'))
    ) {
      const payloadFallback: Record<string, unknown> = {
        nom_complet: cleanName,
        'mot de passe': cleanPass,
        statut: newStatus,
        salons_autorisés: extraList,
      };
      const retry = await supabase.from('users').insert([payloadFallback]);
      error = retry.error;
    }

    setLoading(false);

    if (error) {
      setStatusNotice(`Erreur ajout membre : ${error.message}`);
      return;
    }

    setNewFullName('');
    setNewPhone('');
    setNewPassword('');
    setNewStatus('actif');
    setNewExtraSalons([]);
    setStatusNotice(`Membre "${cleanName}" ajouté.`);
    await fetchAllUsers();
  };

  const handleToggleMemberStatus = async (user: UserRow) => {
    const current = getUserStatus(user).toLowerCase();
    const nextStatus = current === 'actif' ? 'suspendu' : 'actif';
    const { error } = await supabase
      .from('users')
      .update({ statut: nextStatus })
      .eq('id', user.id);

    if (error) {
      setStatusNotice(`Erreur statut : ${error.message}`);
      return;
    }
    setStatusNotice(`Statut de ${getUserName(user)} : ${nextStatus}.`);
    await fetchAllUsers();
  };

  const handleToggleExtraSalonForMember = (userId: string, salonId: string) => {
    if (DEFAULT_SALONS.includes(salonId)) return;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const currentExtra = getExtraAllowedSalons(u);
        const updatedExtra = currentExtra.includes(salonId)
          ? currentExtra.filter((s) => s !== salonId)
          : [...currentExtra, salonId];
        return {
          ...u,
          salons_autorisés: updatedExtra,
        };
      })
    );
  };

  const handleSaveMemberSalons = async (user: UserRow) => {
    const extraList = getExtraAllowedSalons(user);
    const { error } = await supabase
      .from('users')
      .update({
        salons_autorisés: extraList,
      })
      .eq('id', user.id);

    if (error) {
      setStatusNotice(`Erreur mise à jour salons : ${error.message}`);
      return;
    }
    setStatusNotice(`Salons validés pour ${getUserName(user)}.`);
    await fetchAllUsers();
  };

  const handleDeleteMember = async (user: UserRow) => {
    const uName = getUserName(user);
    if (isAdminUser(uName)) {
      setStatusNotice("Impossible de supprimer le compte d'Eric MABOM.");
      return;
    }
    const { error } = await supabase.from('users').delete().eq('id', user.id);
    if (error) {
      setStatusNotice(`Erreur suppression membre : ${error.message}`);
      return;
    }
    setStatusNotice(`Membre "${uName}" supprimé.`);
    await fetchAllUsers();
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = announcement.trim();
    if (!clean || loading) return;

    setLoading(true);
    setStatusNotice('');

    const sample = messages.length > 0 ? messages[0] : null;
    const senderCol = pickField(sample, SENDER_CANDIDATES) || 'expediteur';
    const textCol = pickField(sample, TEXT_CANDIDATES) || 'contenu';

    try {
      for (const salon of SALONS) {
        const { error } = await supabase.from('messages').insert([
          {
            salon: salon.id,
            [senderCol]: 'Eric MABOM',
            [textCol]: `📢 ANNONCE : ${clean}`,
          },
        ]);
        if (error) {
          setStatusNotice(`Erreur sur ${salon.name} : ${error.message}`);
          setLoading(false);
          return;
        }
      }
      setAnnouncement('');
      setStatusNotice('Annonce diffusée dans tous les salons de nkeuya-tchat.');
      await fetchAllMessages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setStatusNotice(`Erreur diffusion : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (authorized !== true) {
    return null;
  }

  const filteredMessages =
    salonFilter === 'all'
      ? messages
      : messages.filter((m) => String(m.salon || '') === salonFilter);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#f0f2f5]">
      <aside className="w-full md:w-64 bg-[#0284c7] text-white flex flex-col shadow-lg shrink-0">
        <div className="p-5 border-b border-white/20">
          <h1 className="text-lg font-bold">🛠️ Administration</h1>
          <p className="text-xs text-white/80">nkeuya-tchat — Eric MABOM</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
              activeTab === 'messages' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            💬 Modération ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
              activeTab === 'members' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            👥 Membres ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('salons')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
              activeTab === 'salons' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            🏛️ Salons ({SALONS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
              activeTab === 'settings' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            📢 Annonces globales
          </button>
        </nav>
        <div className="p-4 border-t border-white/20">
          <button
            type="button"
            onClick={() => router.push('/salon/general')}
            className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            ← Retour aux salons
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {statusNotice && (
          <div className="bg-white border border-sky-300 text-gray-800 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
            {statusNotice}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <h2 className="text-base font-bold text-gray-800">
                🛡️ Modération des messages
              </h2>
              <select
                value={salonFilter}
                onChange={(e) => setSalonFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white"
              >
                <option value="all">Tous les salons</option>
                {SALONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-gray-200 max-h-[65vh] overflow-y-auto">
              {filteredMessages.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  Aucun message trouvé.
                </p>
              ) : (
                filteredMessages.map((msg, idx) => {
                  const sCol = pickField(msg, SENDER_CANDIDATES);
                  const tCol = pickField(msg, TEXT_CANDIDATES);
                  const dCol = pickField(msg, DATE_CANDIDATES);
                  const author = sCol ? String(msg[sCol] || 'Membre') : 'Membre';
                  const body = tCol ? String(msg[tCol] || '') : '';
                  const dateVal = dCol && msg[dCol] ? String(msg[dCol]) : '';

                  return (
                    <div
                      key={typeof msg.id === 'string' ? msg.id : String(idx)}
                      className="py-3 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#0284c7]">
                            [{String(msg.salon || 'general')}]
                          </span>
                          <span className="text-xs font-semibold text-gray-700">
                            {author}
                          </span>
                          {dateVal && (
                            <span className="text-[10px] text-gray-400">
                              {new Date(dateVal).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">
                          {body}
                        </p>
                      </div>
                      {typeof msg.id === 'string' && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteMessage(msg.id as string)}
                          className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold transition shrink-0 cursor-pointer"
                        >
                          🗑️ Supprimer
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateMember}
              className="bg-white rounded-xl shadow p-5 space-y-3"
            >
              <h2 className="text-base font-bold text-gray-800 border-b pb-2">
                ➕ Ajouter un membre
              </h2>
              <p className="text-[11px] text-gray-500">
                Par défaut : 💬 Général et 📸 Photos familiales. Ajoutez ici les salons supplémentaires :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Téléphone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Mot de passe"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs"
                />
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="actif">Actif</option>
                  <option value="en_attente">En attente</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXTRA_SALONS.map((s) => {
                  const active = newExtraSalons.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setNewExtraSalons((prev) =>
                          active ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer ${
                        active
                          ? 'bg-sky-100 border-[#0284c7] text-[#0284c7] font-semibold'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      {s.icon} {s.name}
                    </button>
                  );
                })}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                {loading ? 'Enregistrement...' : 'Ajouter le membre'}
              </button>
            </form>

            <div className="bg-white rounded-xl shadow p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-800 border-b pb-2">
                👥 Membres enregistrés ({users.length})
              </h2>
              <div className="space-y-3">
                {users.map((u) => {
                  const extraAllowed = getExtraAllowedSalons(u);
                  const currentStatut = getUserStatus(u);
                  const isActive = currentStatut.toLowerCase() === 'actif';
                  const uName = getUserName(u);
                  return (
                    <div
                      key={u.id}
                      className="border border-gray-200 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{uName}</p>
                          <p className="text-xs text-gray-500">
                            Tél : {getUserPhoneDisplay(u)} · Statut :{' '}
                            <span
                              className={
                                isActive
                                  ? 'text-emerald-600 font-semibold'
                                  : 'text-amber-600 font-semibold'
                              }
                            >
                              {currentStatut}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleMemberStatus(u)}
                            className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-semibold cursor-pointer"
                          >
                            {isActive ? 'Suspendre' : 'Activer'}
                          </button>
                          {!isAdminUser(uName) && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteMember(u)}
                              className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold cursor-pointer"
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
                        <span className="text-[10px] text-gray-500 font-medium mr-1">
                          Par défaut : 💬 Général, 📸 Photos familiales +
                        </span>
                        {EXTRA_SALONS.map((s) => {
                          const has = extraAllowed.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleToggleExtraSalonForMember(u.id, s.id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] border cursor-pointer ${
                                has
                                  ? 'bg-sky-50 border-[#0284c7] text-[#0284c7] font-medium'
                                  : 'bg-gray-50 border-gray-200 text-gray-400'
                              }`}
                            >
                              {s.icon} {s.name}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => void handleSaveMemberSalons(u)}
                          className="ml-auto bg-[#0284c7] text-white text-[10px] px-2.5 py-1 rounded font-semibold cursor-pointer"
                        >
                          Valider les salons
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'salons' && (
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-800 border-b pb-3">
              🏛️ Salons de nkeuya-tchat
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SALONS.map((s) => (
                <div
                  key={s.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-bold text-[#0284c7]">
                      {s.icon} {s.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Slug : {s.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/salon/${s.id}`)}
                    className="mt-4 text-xs font-semibold text-[#0284c7] hover:underline text-left cursor-pointer"
                  >
                    Ouvrir le salon →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-800 border-b pb-3">
              📢 Annonce globale dans tous les salons
            </h2>
            <form
              onSubmit={handleSendBroadcast}
              className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200"
            >
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Écrire l'annonce à diffuser dans les 7 salons..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0284c7]"
              />
              <button
                type="submit"
                disabled={loading || !announcement.trim()}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Diffusion...' : 'Diffuser dans tous les salons'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}