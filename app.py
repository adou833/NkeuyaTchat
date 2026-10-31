import streamlit as st
from supabase import create_client, Client
import json
from datetime import datetime, timedelta, timezone

# Configuration de la page
st.set_page_config(page_title="NkeuyaTchat", page_icon="💬", layout="centered")

# Connexion Supabase via Streamlit Secrets
@st.cache_resource
def init_supabase():
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)

supabase = init_supabase()

# Initialisation des variables de session
if "user" not in st.session_state:
    st.session_state.user = None
if "theme_color" not in st.session_state:
    st.session_state.theme_color = "WhatsApp Classic"
if "session_id" not in st.session_state:
    st.session_state.session_id = None

# --- PERSONNALISATION DESIGN STYLE WHATSAPP & ARRONDIS GLOBAUX ---
theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Bleu Nkeuya": "#0084FF",
    "Vert Sombre": "#128C7E"
}

primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

st.markdown(f"""
    <style>
    /* Fond général de la page */
    .stApp {{
        background-color: #ECE5DD;
    }}
    
    /* Conteneur principal avec arrondis en haut et en bas */
    [data-testid="stMain"], .main {{
        background-color: #FFFFFF !important;
        border-radius: 28px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important;
        margin: 20px auto !important;
        max-width: 730px !important;
    }}
    
    [data-testid="stMainBlockContainer"], [data-testid="block-container"] {{
        padding: 20px !important;
        border-radius: 28px !important;
    }}
    
    /* En-tête décalé vers le bas et épuré style WhatsApp */
    .main-header {{
        background-color: {primary_color};
        color: white;
        padding: 10px 14px;
        border-radius: 16px;
        text-align: center;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        margin-top: 10px;
        margin-bottom: 15px;
    }}
    .main-header h1, .main-header h2 {{
        font-size: 1.1rem !important;
        margin: 0 !important;
        padding: 0 !important;
    }}

    /* Boutons arrondis */
    .stButton>button {{
        background-color: {primary_color};
        color: white;
        border-radius: 20px;
        border: none;
        padding: 8px 16px;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }}
    .stButton>button:hover {{
        opacity: 0.9;
    }}

    /* Champs de saisie agrandis et arrondis */
    .stTextInput input {{
        border-radius: 22px !important;
        padding: 12px 16px !important;
        font-size: 1rem !important;
        min-height: 45px !important;
    }}
    
    .stSelectbox select {{
        border-radius: 18px !important;
    }}

    /* Bulles de messages et conteneurs arrondis */
    .stChatMessage {{
        border-radius: 14px !important;
        padding: 10px;
        margin-bottom: 8px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }}
    </style>
""", unsafe_allow_html=True)

# --- INTERFACE DE CONNEXION / INSCRIPTION ---
if not st.session_state.user:
    st.markdown("<div class='main-header'><h1>💬 NkeuyaTchat Familial</h1></div>", unsafe_allow_html=True)
    tab1, tab2 = st.tabs(["🔑 Se Connecter", "📝 Créer son compte"])

    with tab1:
        st.subheader("Connexion")
        prenom_login = st.text_input("Prénom *", key="login_prenom")
        pwd_login = st.text_input("Mot de passe *", type="password", key="login_pwd")
        if st.button("🚀 Se Connecter", key="btn_login"):
            clean_prenom = prenom_login.strip() if prenom_login else ""
            
            res = supabase.table("profiles").select("*").eq("prenom", clean_prenom).eq("password", pwd_login).execute()
            if res.data:
                user_data = res.data[0]
                st.session_state.user = user_data
                
                # Enregistrement de la connexion
                default_salon = "Salon : Général"
                session_res = supabase.table("user_sessions").insert({
                    "prenom": user_data["prenom"],
                    "nom": user_data["nom"],
                    "salon": default_salon
                }).execute()
                
                if session_res.data:
                    st.session_state.session_id = session_res.data[0]["id"]
                
                st.success(f"Bienvenue {user_data['prenom']} !")
                st.rerun()
            else:
                st.error("Prénom ou mot de passe incorrect.")

    with tab2:
        st.subheader("CREER SON COMPTE")
        nom = st.text_input("Le Nom *", key="signup_nom")
        prenom = st.text_input("Prénom *", key="signup_prenom")
        phone = st.text_input("Le Numéro de téléphone *", key="signup_phone")
        groupe = st.selectbox("Choisir votre salon familial *", ["Femmes", "Hommes", "Filles", "Petits fils et filles"], key="signup_groupe")
        password = st.text_input("Créer un mot de passe fort *", type="password", key="signup_pwd")
        
        is_admin = True if prenom.strip().lower() == "eric" else False

        if st.button("✨ S'inscrire", key="btn_signup"):
            if nom and prenom and phone and password:
                new_user = {
                    "nom": nom.strip(), "prenom": prenom.strip(), "phone": phone.strip(),
                    "groupe": groupe, "password": password, "is_admin": is_admin
                }
                try:
                    supabase.table("profiles").insert(new_user).execute()
                    st.success("Compte créé avec succès ! Connectez-vous dans l'onglet 'Se Connecter'.")
                except Exception as e:
                    st.error("Erreur : Ce numéro de téléphone est déjà enregistré.")
            else:
                st.warning("Tous les champs sont obligatoires.")

# --- INTERFACE PRINCIPALE DE MESSAGERIE ---
else:
    user = st.session_state.user
    st.markdown(f"<div class='main-header'><h2>💬 NkeuyaTchat - Salut {user['prenom']} !</h2></div>", unsafe_allow_html=True)

    # Barre latérale (Sidebar)
    with st.sidebar:
        st.write(f"👤 **{user['prenom']} {user['nom']}**")
        if user.get("is_admin"):
            st.markdown("⭐ **ADMINISTRATEUR (Eric)**")
        
        st.divider()
        st.subheader("🎨 Thème WhatsApp")
        st.session_state.theme_color = st.radio("Couleur :", ["WhatsApp Classic", "Bleu Nkeuya", "Vert Sombre"], key="theme_radio")

        st.divider()
        salons_accessibles = ["Salon : Général", "Salon : Photos de la famille Nkeuya"]
        if user["groupe"] == "Femmes":
            salons_accessibles.append("Salon : Femmes")
        elif user["groupe"] == "Hommes":
            salons_accessibles.append("Salon : Hommes")
        elif user["groupe"] == "Filles":
            salons_accessibles.append("Salon : Filles")
        elif user["groupe"] == "Petits fils et filles":
            salons_accessibles.append("Salon : Petits fils et filles")
            
        salon_choisi = st.selectbox("📌 Choisir un salon", salons_accessibles, key="select_salon")

        # Mettre à jour le salon actif dans la session
        if st.session_state.session_id:
            supabase.table("user_sessions").update({"salon": salon_choisi}).eq("id", st.session_state.session_id).execute()

        # --- MEMBRES DE LA FAMILLE ---
        st.divider()
        with st.expander("👥 Membres de la Famille"):
            profiles = supabase.table("profiles").select("prenom", "nom", "groupe").execute().data
            for p in profiles:
                st.write(f"• **{p['prenom']} {p['nom']}** ({p['groupe']})")

        st.divider()
        if st.button("🚪 Déconnexion Complète", key="btn_logout"):
            if st.session_state.session_id:
                now_utc = datetime.now(timezone.utc).isoformat()
                supabase.table("user_sessions").update({"logout_at": now_utc}).eq("id", st.session_state.session_id).execute()
            
            st.session_state.user = None
            st.session_state.session_id = None
            st.rerun()

    # --- ESPACE DE CHAT ---
    st.subheader(f"🗣️ {salon_choisi}")

    # Barre de recherche style WhatsApp
    search_query = st.text_input("🔍 Rechercher dans les messages", placeholder="Tapez un mot-clé...", key="whatsapp_search")

    is_photo_salon = "Photos" in salon_choisi
    can_post = True
    if is_photo_salon and not user.get("is_admin"):
        can_post = False
        st.info("🔒 Ce salon est en lecture seule. Seul l'administrateur (Eric) peut y ajouter des photos.")

    # Filtrage des messages des 30 derniers jours et non bloqués
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    messages = supabase.table("messages").select("*").eq("salon", salon_choisi).eq("is_blocked", False).gte("created_at", thirty_days_ago).execute().data
    
    if search_query:
        messages = [m for m in messages if search_query.lower() in m["content"].lower()]

    for msg in messages:
        with st.chat_message("user" if msg["sender_prenom"] != user["prenom"] else "assistant"):
            st.write(f"**{msg['sender_prenom']}** : {msg['content']}")
            if msg.get("file_url"):
                st.image(msg["file_url"])

    # Zone de saisie des messages
    if can_post:
        st.divider()
        
        msg_text = st.text_input("💬 Écris ton message ici...", key="input_msg")
        uploaded_file = st.file_uploader("📎 Partager une photo ou un document", type=["png", "jpg", "jpeg", "pdf"], key="file_upload")
        
        col1, col2 = st.columns([1, 4])
        with col1:
            if st.button("🎙️ Voice", key="btn_voice"):
                st.toast("Fonction vocale bientôt active !")
        with col2:
            if st.button("📤 Envoyer", key="btn_send"):
                if msg_text or uploaded_file:
                    supabase.table("messages").insert({
                        "sender_prenom": user["prenom"],
                        "sender_phone": user["phone"],
                        "salon": salon_choisi,
                        "content": msg_text
                    }).execute()
                    st.rerun()

    # --- PANNEAU D'ADMINISTRATION (POUR ERIC) ---
    if user.get("is_admin"):
        with st.expander("🛠️ Panneau d'Administration (Accès Eric)"):
            st.write("📊 **Suivi des connexions et activité des membres :**")
            
            sessions_data = supabase.table("user_sessions").select("*").order("login_at", desc=True).limit(20).execute().data
            
            if sessions_data:
                for s in sessions_data:
                    try:
                        login_dt = datetime.fromisoformat(s["login_at"].replace("Z", "+00:00"))
                        login_str = login_dt.strftime("%d/%m/%Y à %H:%M")
                    except:
                        login_str = s["login_at"]
                    
                    if s.get("logout_at"):
                        try:
                            logout_dt = datetime.fromisoformat(s["logout_at"].replace("Z", "+00:00"))
                            logout_str = logout_dt.strftime("%d/%m/%Y à %H:%M")
                            status = f"🔴 Inactif depuis {logout_str}"
                        except:
                            status = f"🔴 Inactif ({s['logout_at']})"
                    else:
                        status = "🟢 Actif en ce moment"
                        
                    st.markdown(f"• **{s['prenom']} {s['nom']}** — 📌 *{s['salon']}* <br>⏳ Connecté le : {login_str} | {status}", unsafe_allow_html=True)
            else:
                st.info("Aucun historique de connexion pour le moment.")
                
            st.divider()
            if st.button("⚙️ Réinitialiser le mot de passe d'un membre", key="admin_pwd"):
                st.info("Module de réinitialisation actif.")
            if st.button("🚫 Gérer les messages indésirables", key="admin_mod"):
                st.info("Module de modération actif.")
