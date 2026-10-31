import streamlit as st
from supabase import create_client, Client
import json
from datetime import datetime, timedelta, timezone
import bcrypt

# Configuration de la page
st.set_page_config(page_title="NkeuyaTchat", page_icon="💬", layout="centered")

# Connexion Supabase via Streamlit Secrets
@st.cache_resource
def init_supabase():
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)

supabase = init_supabase()

# Fonctions utilitaires pour les mots de passe sécurisés
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

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
            
            # Récupérer l'utilisateur par son prénom
            res = supabase.table("profiles").select("*").eq("prenom", clean_prenom).execute()
            
            if res.data:
                user_data = res.data[0]
                stored_password = user_data["password"]
                
                # Vérification sécurisée du mot de passe (gère aussi l'ancienne version en clair si besoin)
                is_valid = verify_password(pwd_login, stored_password) or (pwd_login == stored_password)
                
                if is_valid:
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
                # Hachage sécurisé du mot de passe avant l'enregistrement
                hashed_pwd = hash_password(password)
                
                new_user = {
                    "nom": nom.strip(), 
                    "prenom": prenom.strip(), 
                    "phone": phone.strip(),
                    "groupe": groupe, 
                    "password": hashed_pwd, 
                    "is_admin": is_admin
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

        # --- PANNEAU D'ADMINISTRATION DANS LA SIDEBAR (POUR ERIC) ---
        if user.get("is_admin"):
            st.divider()
            with st.expander("🛠️ Panneau d'Administration"):
                admin_tab1, admin_tab2 = st.tabs(["📊 Connexions", "👥 Gestion Comptes"])
                
                # --- SOUS-ONGLET 1 : SUIVI DES CONNEXIONS ---
                with admin_tab1:
                    st.write("**Activité récente :**")
                    sessions_data = supabase.table("user_sessions").select("*").order("login_at", desc=True).limit(10).execute().data
                    
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
                                    status = f"🔴 Inactif ({logout_str})"
                                except:
                                    status = "🔴 Inactif"
                            else:
                                status = "🟢 En ligne"
                                
                            st.markdown(f"• **{s['prenom']} {s['nom']}**<br>📌 *{s['salon']}*<br>⏳ {login_str} | {status}", unsafe_allow_html=True)
                            st.markdown("---")
                    else:
                        st.info("Aucun historique.")

                # --- SOUS-ONGLET 2 : GESTION, RECHERCHE & MODIFICATION DES COMPTES ---
                with admin_tab2:
                    st.write("**Gérer les membres :**")
                    admin_search = st.text_input("🔍 Rechercher un membre", placeholder="Tapez un prénom ou nom...", key="admin_search_member")
                    
                    all_profiles = supabase.table("profiles").select("*").execute().data
                    
                    if admin_search:
                        all_profiles = [p for p in all_profiles if admin_search.lower() in p['prenom'].lower() or admin_search.lower() in p['nom'].lower()]
                    
                    if all_profiles:
                        for p in all_profiles:
                            st.markdown(f"👤 **{p['prenom']} {p['nom']}**<br>📞 `{p['phone']}` | 📌 *{p['groupe']}*", unsafe_allow_html=True)
                            
                            with st.expander(f"Modifier {p['prenom']} {p['nom']}"):
                                edit_prenom = st.text_input("Prénom", value=p['prenom'], key=f"edit_prenom_{p['phone']}")
                                edit_nom = st.text_input("Nom", value=p['nom'], key=f"edit_nom_{p['phone']}")
                                edit_phone = st.text_input("Téléphone", value=p['phone'], key=f"edit_phone_{p['phone']}")
                                
                                groupes_possibles = ["Femmes", "Hommes", "Filles", "Petits fils et filles"]
                                current_idx = groupes_possibles.index(p['groupe']) if p['groupe'] in groupes_possibles else 0
                                edit_groupe = st.selectbox("Salon / Groupe", groupes_possibles, index=current_idx, key=f"edit_grp_{p['phone']}")
                                
                                edit_pwd = st.text_input("Nouveau mot de passe (laisser vide pour ne pas changer)", type="password", key=f"edit_pwd_{p['phone']}")
                                
                                col_btn1, col_btn2 = st.columns(2)
                                with col_btn1:
                                    if st.button("💾 Sauvegarder", key=f"save_profile_{p['phone']}"):
                                        update_payload = {
                                            "prenom": edit_prenom.strip(),
                                            "nom": edit_nom.strip(),
                                            "phone": edit_phone.strip(),
                                            "groupe": edit_groupe
                                        }
                                        # Si Eric entre un nouveau mot de passe, on le hache !
                                        if edit_pwd.strip():
                                            update_payload["password"] = hash_password(edit_pwd.strip())
                                        
                                        supabase.table("profiles").update(update_payload).eq("phone", p['phone']).execute()
                                        st.success("Modifications enregistrées !")
                                        st.rerun()
                                with col_btn2:
                                    if p['prenom'].lower() != "eric":
                                        if st.button("🗑️ Supprimer", key=f"del_profile_{p['phone']}"):
                                            supabase.table("profiles").delete().eq("phone", p['phone']).execute()
                                            st.warning("Compte supprimé.")
                                            st.rerun()
                            st.markdown("---")
                    else:
                        st.info("Aucun membre trouvé.")

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
