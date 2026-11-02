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
