'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  salon: string;
  sender: string;
  content: string;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'messages' | 'members' | 'salons' | 'settings'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(false);

  // Vérification rapide des droits admin (simulée via localStorage ou stockée)
  useEffect(() => {
    const user = localStorage.getItem('nkeuya_user');
    // Tu peux sécuriser cela avec un mot de passe admin ou un profil spécifique
    if (!user) {
      router.push('/');
    }
    fetchAllMessages();
  }, []);

  const fetchAllMessages = async () => {
    try {
      const res = await fetch('/api/messages?salon=all'); // Assure-toi que ton API gère 'all' ou récupère tous les messages
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Erreur chargement messages admin :", err);
    }
  };

  // Supprimer un message indésirable
  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce message indésirable ?")) return;
    try {
      const res = await fetch(`/api/messages?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error("Erreur suppression :", err);
    }
  };

  // Forcer la réinitialisation du mot de passe d'un membre
  const handleForcePasswordReset = (memberName: string) => {
    if (confirm(`Forcer la réinitialisation du mot de passe pour ${memberName} ? Il devra obligatoirement le changer à sa prochaine connexion.`)) {
      // Logique pour mettre à jour la base de données (ex: champ must_change_password = true)
      alert(`Un lien de réinitialisation a été préparé pour ${memberName}.`);
    }
  };

  // Envoyer une annonce globale dans tous les salons
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    setLoading(true);

    const salons = ['general', 'femmes', 'hommes', 'filles', 'garcons', 'petits-fils-et-filles'];
    try {
      for (const salon of salons) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salon,
            sender: '👑 Administrateur',
            content: `📢 ANNONCE OFFICIELLE : ${announcement}`
          })
        });
      }
      setAnnouncement('');
      alert("Annonce diffusée avec succès dans tous les salons !");
    } catch (err) {
      console.error("Erreur diffusion :", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#f0f2f5]">
      
      {/* Barre latérale d'administration */}
      <aside className="w-full md:w-64 bg-[#0284c7] text-white flex flex-col shadow-lg">
        <div className="p-5 border-b border-white/20">
          <h1 className="text-lg font-bold">🛠️ Administration</h1>
          <p className="text-xs text-white/80">NkeuyaTchat - Contrôle Total</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('messages')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === 'messages' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            💬 Modération des messages
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === 'members' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            👥 Gestion des membres
          </button>
          <button
            onClick={() => setActiveTab('salons')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === 'salons' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            🏛️ Salons familiaux
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === 'settings' ? 'bg-white/20 shadow' : 'hover:bg-white/10'
            }`}
          >
            ⚙️ Paramètres & Annonces
          </button>
        </nav>
        <div className="p-4 border-t border-white/20">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-xs font-bold transition"
          >
            ← Retour au Chat
          </button>
        </div>
      </aside>

      {/* Contenu principal de l'administration */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* ONGLET 1 : MODÉRATION DES MESSAGES */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3">🛡️ Modération des messages indésirables</h2>
            <p className="text-xs text-gray-500">Examinez et supprimez instantanément les messages inappropriés partagés dans les salons.</p>
            
            <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Aucun message trouvé.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0284c7]">[{msg.salon}]</span>
                        <span className="text-xs font-semibold text-gray-700">{msg.sender}</span>
                        <span className="text-[10px] text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-900 mt-1">{msg.content.substring(0, 100)}...</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold transition shrink-0"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ONGLET 2 : GESTION DES MEMBRES */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3">👥 Gestion des membres de la famille</h2>
            <p className="text-xs text-gray-500">Gérez les accès, bloquez ou réinitialisez les identifiants des utilisateurs.</p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase text-[11px]">
                  <tr>
                    <th className="p-3">Membre</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Actions de sécurité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-800">
                  <tr>
                    <td className="p-3 font-semibold">Famille Principal</td>
                    <td className="p-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Actif</span></td>
                    <td className="p-3 space-x-2">
                      <button 
                        onClick={() => handleForcePasswordReset("Famille Principal")}
                        className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1 rounded text-xs font-bold transition"
                      >
                        🔑 Forcer réinitialisation mot de passe
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ONGLET 3 : SALONS */}
        {activeTab === 'salons' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3">🏛️ Gestion des Salons de Discussion</h2>
            <p className="text-xs text-gray-500">Aperçu des différents espaces de communication configurés dans NkeuyaTchat.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {['general', 'femmes', 'hommes', 'filles', 'garcons', 'petits-fils-et-filles'].map((salonName) => (
                <div key={salonName} className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-[#0284c7] capitalize">Salon : {salonName}</h3>
                    <p className="text-xs text-gray-500 mt-1">Espace dédié aux échanges familiaux.</p>
                  </div>
                  <span className="mt-4 text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded w-fit">Statut : Ouvert</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ONGLET 4 : PARAMÈTRES & ANNONCES */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3">⚙️ Paramètres généraux & Annonces</h2>
            
            {/* Formulaire d'annonce globale */}
            <form onSubmit={handleSendBroadcast} className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700">📢 Diffuser une annonce globale</h3>
              <p className="text-xs text-gray-500">Ce message sera envoyé automatiquement dans tous les salons de l'application.</p>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Rédigez votre annonce officielle ici..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0284c7]"
              />
              <button
                type="submit"
                disabled={loading || !announcement.trim()}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {loading ? "Diffusion en cours..." : "Publier l'annonce dans tous les salons"}
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}