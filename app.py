import streamlit as st
from supabase import create_client, Client
from datetime import datetime, timezone
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

# --- DESIGN & COULEURS DU THÈME ---
theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Bleu Nkeuya": "#0084FF",
    "Vert Sombre": "#128C7E"
}

primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

st.markdown(f"""
    <style>
    /* Masquer le pied de page Streamlit et les badges cloud */
    footer {{ visibility: hidden; }}
    [data-testid="stDecoration"] {{ display: none !important; }}
    .viewerBadge_container {{ display: none !important; }}

    /* Bandeau compact et élégant avec la couleur dynamique */
    .main-header {{
        background-color: {primary_color};
        color: white;
        padding: 10px 14px;
        border-radius: 12px;
        text-align: center;
        margin-top: -10px;
        margin-bottom: 15px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.12);
    }}
    .main-header h2 {{
        font-size: 1.1rem !important;
        color: white !important;
        margin: 0 !important;
        padding: 0 !important;
    }}
    .main-header p {{
        font-size: 0.8rem !important;
        color: #E0E0E0 !important;
        margin: 3px 0 0 0 !important;
    }}
    </style>
""", unsafe_allow_html=True)

# --- INTERFACE DE CONNEXION / INSCRIPTION ---
if not st.session_state.user:
    st.markdown("<div class='main-header'><h2>💬 NkeuyaTchat Familial</h2><p>Espace sécurisé de la famille Nkeuya</p></div>", unsafe_allow_html=True)
    tab1, tab2 = st.tabs(["🔑 Se Connecter", "📝 Créer son compte"])

    with tab1:
        st.subheader("Connexion")
        prenom_login = st.text_input("Prénom *", key="login_prenom")
        pwd_login = st.text_input("Mot de passe *", type="password", key="login_pwd")
        if st.button("🚀 Se Connecter", key="btn_login"):
            clean_prenom = prenom_
