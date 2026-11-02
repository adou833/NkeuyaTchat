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

# --- DESIGN PROPRE ET ESPACEMENT MOBILE ---
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
    
    /* Conteneur principal avec arrondis en haut, fond blanc et marge de sécurité en haut */
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
                        st.error("⚠️ Erreur : Ce numéro de téléphone est déjà enregistré.")
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
        
        salons_accessibles = ["Salon : Général", "Salon : Photos de la famille Nkeuya"]
        
        groupe_user = user.get("groupe", "")
        if groupe_user == "Femmes":
            salons_accessibles.append("Salon : Groupe Privé Femmes")
        elif groupe_user == "Hommes":
            salons_accessibles.append("Salon : Groupe Privé Hommes")
        elif groupe_user == "Filles":
            salons_accessibles.append("Salon : Groupe Privé Filles")
        elif groupe_user == "Petits fils et filles":
            salons_accessibles.append("Salon : Groupe Privé Petits-enfants")
            
        if user.get("is_admin"):
            salons_accessibles.extend(["Salon : Administration & Annonces", "Salon : Échanges Techniques"])

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
        st.info("Suivi en temps réel de l'activité de NkeuyaTchat.")
        
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
        
        st.markdown("### 👥 Liste des utilisateurs enregistrés")
        try:
            res_users = supabase.table("profiles").select("nom, prenom, phone, groupe, is_admin").execute()
            if res_users.data:
                st.dataframe(res_users.data, use_container_width=True)
            else:
                st.write("Aucun utilisateur trouvé.")
        except Exception:
            st.error("Impossible de charger les profils depuis Supabase.")
            
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
