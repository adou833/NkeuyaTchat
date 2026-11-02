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

# --- DESIGN WHATSAPP & VISIBILITÉ ---
theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Bleu Nkeuya": "#0084FF",
    "Vert Sombre": "#128C7E"
}

primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

st.markdown(f"""
    <style>
    /* Fond général de l'application (style WhatsApp) */
    html, body, .stApp {{
        background-color: #ECE5DD !important;
    }}
    
    /* Conteneur principal avec arrondis en haut, fond blanc et marge de sécurité */
    [data-testid="stMain"], .main {{
        background-color: #FFFFFF !important;
        border-radius: 28px 28px 0 0 !important;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.1) !important;
        max-width: 730px !important;
        margin: 0 auto !important;
        padding-top: 15px !important;
    }}
    
    [data-testid="stMainBlockContainer"], [data-testid="block-container"] {{
        padding: 20px !important;
        padding-top: 30px !important;
    }}
    
    /* Bandeau NkeuyaTchat bien visible et espacé */
    .main-header {{
        background-color: {primary_color};
        color: white;
        padding: 12px 16px;
        border-radius: 16px;
        text-align: center;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        margin-top: 15px;
        margin-bottom: 25px;
    }}
    .main-header h1, .main-header h2 {{
        font-size: 1.2rem !important;
        margin: 0 !important;
        padding: 0 !important;
        color: white !important;
    }}

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

    .stTextInput input {{
        border-radius: 22px !important;
        padding: 10px 14px !important;
        font-size: 1rem !important;
        min-height: 40px !important;
    }}
    
    .stSelectbox select {{
        border-radius: 18px !important;
    }}

    /* Styles pour rendre les messages du chat clairement visibles */
    [data-testid="stChatMessage"] {{
        background-color: #F0F2F5 !important;
        border-radius: 14px !important;
        padding: 12px !important;
        margin-bottom: 10px !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
        color: #000000 !important;
    }}
    
    [data-testid="stChatMessage"] p, [data-testid="stChatMessage"] span {{
        color: #111111 !important;
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
            clean_prenom = prenom_login.strip().lower() if prenom_login else ""
            
            try:
                res = supabase.table("profiles").select("*").execute()
                user_data = None
                if res.data:
                    for p in res.data:
                        if p.get("prenom", "").strip().lower() == clean_prenom:
                            user_data = p
                            break
                
                if user_data:
                    stored_password = user_data["password"]
                    is_valid = verify_password(pwd_login, stored_password) or (pwd_login == stored_password)
                    
                    if is_valid:
                        st.session_state.user = user_data
                        default_salon = "Salon : Général"
                        try:
                            session_res = supabase.table("user_sessions").insert({
                                "prenom": user_data["prenom"],
                                "nom": user_data["nom"],
                                "salon": default_salon
                            }).execute()
                            if session_res.data:
                                st.session_state.session_id = session_res.data[0]["id"]
                        except Exception:
                            pass
                        
                        st.success(f"Bienvenue {user_data['prenom']} !")
                        st.rerun()
                    else:
                        st.error("Mot de passe incorrect.")
                else:
                    st.error("Prénom introuvable. Vérifiez l'orthographe.")
            except Exception as e:
                st.error("Erreur de connexion à la table 'profiles'. Vérifiez Supabase.")

    with tab2:
        st.subheader("Créer son compte")
        nom = st.text_input("Le Nom *", key="signup_nom")
        prenom = st.text_input("Prénom *", key="signup_prenom")
        phone = st.text_input("Le Numéro de téléphone *", key="signup_phone")
        groupe = st.selectbox("Choisir votre salon familial *", ["Femmes", "Hommes", "Filles", "Petits fils et filles"], key="signup_groupe")
        
        password = st.text_input("Créer un mot de passe (min. 6 caractères) *", type="password", key="signup_pwd")
        confirm_password = st.text_input("Confirmer le mot de passe *", type="password", key="signup_pwd_confirm")
        
        is_admin = True if prenom.strip().lower() == "eric" else False

        if st.button("✨ S'inscrire", key="btn_signup"):
            if nom and prenom and phone and password and confirm_password:
                if len(password) < 6:
                    st.warning("⚠️ Le mot de passe est trop court (min. 6 caractères).")
                elif password != confirm_password:
                    st.error("❌ Les mots de passe ne correspondent pas.")
                else:
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
                        st.success("🎉 Compte créé avec succès ! Connectez-vous dans l'onglet 'Se Connecter'.")
                    except Exception as e:
                        st.error(f"⚠️ Erreur : {e}")
            else:
                st.warning("Tous les champs sont obligatoires.")

# --- INTERFACE PRINCIPALE DE MESSAGERIE & ADMIN ---
else:
    user = st.session_state.user
    st.markdown(f"<div class='main-header'><h2>💬 NkeuyaTchat - Salut {user['prenom']} !</h2></div>", unsafe_allow_html=True)

    # Barre latérale (Sidebar) standard gérée nativement par Streamlit
    with st.sidebar:
        st.write(f"👤 **{user['prenom']} {user['nom']}**")
        if user.get("is_admin"):
            st.markdown("⭐ **ADMINISTRATEUR (Eric)**")
        
        st.divider()
        st.subheader("🎨 Thème WhatsApp")
        st.session_state.theme_color = st.radio("Couleur :", ["WhatsApp Classic", "Bleu Nkeuya", "Vert Sombre"], key="theme_radio")

        st.divider()
        st.subheader("💬 Salons de Discussion")
        
        salons_accessibles = [
            "Salon : Général", 
            "Salon : Photos de la famille Nkeuya", 
            "Salon : Femmes", 
            "Salon : Filles", 
            "Salon : Garçons", 
            "Salon : Petits fils/filles"
        ]

        salon_actif = st.selectbox("Choisir un salon actif", salons_accessibles)

        vue_admin = False
        if user.get("is_admin"):
            st.divider()
            st.subheader("⚙️ Administration")
            if st.checkbox("📊 Ouvrir le tableau de bord Admin", key="toggle_admin_view"):
                vue_admin = True

        st.divider()
        if st.button("🚪 Se déconnecter"):
            if st.session_state.session_id:
                try:
                    supabase.table("user_sessions").delete().eq("id", st.session_state.session_id).execute()
                except Exception:
                    pass
            st.session_state.user = None
            st.session_state.session_id = None
            st.rerun()

    # --- VUE ADMIN OU VUE MESSAGERIE ---
    if user.get("is_admin") and vue_admin:
        st.subheader("📊 Tableau de Bord Administrateur (Eric)")
        st.info("Suivi en temps réel et gestion des utilisateurs de NkeuyaTchat.")
        
        col1, col2 = st.columns(2)
        with col1:
            try:
                profiles_res = supabase.table("profiles").select("*", count="exact").execute()
                total_users = len(profiles_res.data) if profiles_res.data else 0
                st.metric("Utilisateurs Inscrits", total_users)
            except Exception:
                st.metric("Utilisateurs Inscrits", "N/A")
                
        with col2:
            try:
                sessions_res = supabase.table("user_sessions").select("*").execute()
                active_sessions = len(sessions_res.data) if sessions_res.data else 0
                st.metric("Sessions Actives", active_sessions)
            except Exception:
                st.metric("Sessions Actives", "N/A")
        
        st.markdown("### 👥 Gestion des utilisateurs")
        try:
            res_users = supabase.table("profiles").select("id, nom, prenom, phone, groupe, is_admin").execute()
            if res_users.data:
                for p in res_users.data:
                    p_nom = p.get('nom', '')
                    p_prenom = p.get('prenom', '')
                    p_phone = p.get('phone', '')
                    
                    with st.expander(f"{p_prenom} {p_nom} ({p_phone})"):
                        subcol1, subcol2 = st.columns(2)
                        
                        # 1. Réinitialisation du mot de passe
                        with subcol1:
                            new_pwd = st.text_input(f"Nouveau MDP ({p_prenom})", type="password", key=f"pwd_{p.get('id', p_phone)}")
                            if st.button(f"🔑 Réinitialiser MDP", key=f"btn_reset_{p.get('id', p_phone)}"):
                                if len(new_pwd) >= 6:
                                    hashed = hash_password(new_pwd)
                                    try:
                                        supabase.table("profiles").update({"password": hashed}).eq("phone", p_phone).execute()
                                        st.success(f"Mot de passe de {p_prenom} mis à jour !")
                                    except Exception as ex:
                                        st.error(f"Erreur : {ex}")
                                else:
                                    st.warning("Minimum 6 caractères requis.")
                                    
                        # 2. Suppression du compte
                        with subcol2:
                            st.write("Zone de danger")
                            if st.button(f"🗑️ Supprimer le compte", key=f"btn_delete_{p.get('id', p_phone)}"):
                                if p_prenom.strip().lower() == "eric":
                                    st.error("Impossible de supprimer le compte administrateur principal.")
                                else:
                                    try:
                                        supabase.table("profiles").delete().eq("phone", p_phone).execute()
                                        st.success(f"Compte de {p_prenom} supprimé.")
                                        st.rerun()
                                    except Exception as ex:
                                        st.error(f"Erreur : {ex}")
            else:
                st.write("Aucun utilisateur trouvé.")
        except Exception as e:
            st.error(f"Impossible de charger les profils depuis Supabase : {e}")
            
        st.markdown("### 🟢 Sessions connectées en direct")
        try:
            res_sess = supabase.table("user_sessions").select("*").execute()
            if res_sess.data:
                st.dataframe(res_sess.data, use_container_width=True)
            else:
                st.write("Aucune session active en cours.")
        except Exception:
            st.write("Aucune table de sessions disponible.")

    else:
        # --- CORPS DE LA MESSAGERIE ---
        st.subheader(f"📢 {salon_actif}")

        try:
            response = supabase.table("messages").select("*").eq("salon", salon_actif).order("created_at", desc=False).execute()
            messages = response.data if response.data else []
        except Exception:
            messages = []

        for msg in messages:
            auteur = msg.get('sender_prenom', 'Anonyme')
            is_me = (auteur.strip().lower() == user['prenom'].strip().lower())
            msg_id = msg.get('id')
            reactions = msg.get('reactions', {})
            
            with st.chat_message("user" if is_me else "assistant"):
                st.markdown(f"**{auteur}** : {msg.get('content', '')}")
                
                # Gestion sécurisée des réactions
                if reactions and isinstance(reactions, dict):
                    react_str = " "
                    for emoji, users_list in reactions.items():
                        if users_list:
                            count = len(users_list) if isinstance(users_list, (list, tuple, set)) else 1
                            react_str += f"`{emoji} {count}` "
                    st.caption(react_str)
                
                st.caption(msg.get('created_at', '')[:16].replace('T', ' à '))
                
                # Petits boutons d'emojis rapides pour réagir au message
                cols_react = st.columns(5)
                emojis_dispo = ["👍", "❤️", "😂", "😮", "🙏"]
                for idx, em in enumerate(emojis_dispo):
                    with cols_react[idx]:
                        if st.button(em, key=f"react_{msg_id}_{em}"):
                            current_reactions = dict(reactions) if isinstance(reactions, dict) else {}
                            if em not in current_reactions or not isinstance(current_reactions[em], list):
                                current_reactions[em] = []
                            
                            user_prenom = user['prenom']
                            if user_prenom in current_reactions[em]:
                                current_reactions[em].remove(user_prenom)
                                if not current_reactions[em]:
                                    del current_reactions[em]
                            else:
                                current_reactions[em].append(user_prenom)
                            
                            try:
                                supabase.table("messages").update({"reactions": current_reactions}).eq("id", msg_id).execute()
                                st.rerun()
                            except Exception as ex:
                                st.error(f"Erreur réaction : {ex}")

        if prompt := st.chat_input("Écrivez votre message ici..."):
            nouveau_msg = {
                "salon": salon_actif,
                "content": prompt,
                "sender_prenom": user["prenom"],
                "sender_phone": user["phone"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "reactions": {}
            }
            try:
                supabase.table("messages").insert(nouveau_msg).execute()
                st.rerun()
            except Exception as e:
                st.error(f"❌ Erreur détaillée lors de l'envoi : {e}")
