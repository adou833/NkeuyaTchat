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
    st.session_id = None

# --- PERSONNALISATION DESIGN STYLE WHATSAPP & ARRONDIS GLOBAUX ---
theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Bleu Nkeuya": "#0084FF",
    "Vert Sombre": "#128C7E"
}

primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

st.markdown(f"""
    <style>
    /* ================================================================= */
    /* BLOC SÉCURITÉ : MASQUAGE STRICT DES BARRES ET FOOTER STREAMLIT   */
    /* ================================================================= */
    [data-testid="stToolbar"], 
    [data-testid="stDecoration"], 
    #MainMenu, 
    footer, 
    [data-testid="stStatusWidget"], 
    header,
    .stDeployButton,
    [data-testid="stViewerToolbar"] {{
        visibility: hidden !important; 
        display: none !important;
        height: 0px !important;
    }}
    
    /* ================================================================= */
    /* SUPPRESSION DES VIDES ET PLEINE HAUTEUR POUR MOBILE               */
    /* ================================================================= */
    /* Supprime les espaces blancs tout en haut imposés par Streamlit */
    [data-testid="stAppViewBlockContainer"] {{
        padding-top: 0px !important;
        padding-bottom: 0px !important;
    }}
    
    /* Fond général de la page */
    .stApp {{
        background-color: #ECE5DD;
    }}
    
    /* Conteneur principal collé en haut, pleine hauteur sur mobile */
    [data-testid="stMain"], .main {{
        background-color: #FFFFFF !important;
        border-radius: 0px 0px 28px 28px !important; /* Arrondi seulement en bas */
        box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important;
        margin: 0 auto !important; /* Supprime le décalage du haut (margin-top à 0) */
        max-width: 730px !important;
        min-height: 100vh !important; /* Force l'application à prendre tout l'écran */
    }}
    
    [data-testid="stMainBlockContainer"], [data-testid="block-container"] {{
        padding: 15px !important;
        margin-top: 0px !important;
    }}
    
    /* En-tête style WhatsApp - Collé en haut */
    .main-header {{
        background-color: {primary_color};
        color: white;
        padding: 14px 14px;
        border-radius: 0px 0px 16px 16px; /* Arrondi uniquement en bas pour coller le haut */
        text-align: center;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        margin-top: -15px; /* Compense le léger padding restant */
        margin-left: -15px;
        margin-right: -15px;
        margin-bottom: 20px;
    }}
    .main-header h1, .main-header h2 {{
        font-size: 1.2rem !important;
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
            clean_prenom = prenom_login.strip().lower() if prenom_login else ""
            
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
                    st.error("Mot de passe incorrect.")
            else:
                st.error("Prénom introuvable. Vérifiez l'orthographe.")

    with tab2:
        st.subheader("CREER SON COMPTE")
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
                    st.warning("⚠️ Le mot de passe est trop court. Il doit contenir au moins 6 caractères.")
                elif password != confirm_password:
                    st.error("❌ Les deux mots de passe ne correspondent pas.")
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
            salons_accessibles.append("Salon : Groupe Privé Femmes")
        
        # Vous pouvez continuer à coder vos salons et l'affichage des messages ici...
