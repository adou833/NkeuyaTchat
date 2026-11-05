import streamlit as st
from supabase import create_client, Client

# ---------------------------------------------------------
# 1. Configuration de la page
# ---------------------------------------------------------
st.set_page_config(
    page_title="NkeuyaTchat", 
    page_icon="💬", 
    layout="centered"
)

# ---------------------------------------------------------
# 2. Connexion Supabase via Streamlit Secrets
# ---------------------------------------------------------
@st.cache_resource
def init_supabase() -> Client:
    try:
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]
        return create_client(url, key)
    except Exception as e:
        st.error(f"Erreur de connexion aux secrets Supabase : {e}")
        st.stop()

supabase = init_supabase()

# ---------------------------------------------------------
# 3. Gestion de la session persistante via les paramètres URL
# ---------------------------------------------------------
query_params = st.query_params

if "user" not in st.session_state:
    st.session_state.user = None

if not st.session_state.user and "logged_user" in query_params:
    saved_prenom = query_params["logged_user"]
    try:
        res = supabase.table("profiles").select("*").eq("prenom", saved_prenom).execute()
        if res.data:
            st.session_state.user = res.data[0]
    except Exception:
        pass

if "theme_color" not in st.session_state:
    st.session_state.theme_color = "WhatsApp Classic"

theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Bleu Nkeuya": "#128C7E",
    "Vert Sombre": "#0084FF"
}
primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

# ---------------------------------------------------------
# 4. Style CSS Global
# ---------------------------------------------------------
st.markdown(f"""
    <style>
    div[data-testid="stToolbar"], header[data-testid="stHeader"], div.stAppToolbar, button[kind="header"], #MainMenu, footer, [data-testid="stStatusWidget"] {{
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }}

    .stApp {{
        background-color: #ECE5DD;
    }}
    
    .main .block-container {{
        background-color: #FFFFFF;
        border-radius: 12px;
        padding: 0.4rem 0.6rem !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        margin-top: 5px;
        margin-bottom: 10px;
    }}

    .whatsapp-app-title {{
        color: {primary_color};
        font-size: 1.6rem !important;
        font-weight: 800 !important;
        margin: 0px !important;
        letter-spacing: -0.5px;
    }}
    
    div[data-testid="stRadio"] label p {{
        font-weight: 800 !important;
        font-size: 0.85rem !important;
        color: {primary_color} !important;
    }}

    .stButton>button {{
        background-color: {primary_color};
        color: white;
        border-radius: 8px;
        border: none;
        padding: 8px 12px;
        font-weight: bold;
        width: 100%;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }}
    .stButton>button:hover {{
        opacity: 0.9;
        color: white;
    }}

    .stTextInput input, .stSelectbox select {{
        border-radius: 10px !important;
    }}
    </style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------
# 5. Interface de Connexion / Inscription
# ---------------------------------------------------------
if not st.session_state.user:
    st.markdown(f"<div class='whatsapp-app-title'>NkeuyaTchat</div>", unsafe_allow_html=True)
    tab1, tab2 = st.tabs(["🔑 Se Connecter", "📝 Créer son compte"])

    with tab1:
        st.subheader("Connexion à votre espace")
        with st.form("form_connexion"):
            prenom_login = st.text_input("Prénom *")
            pwd_login = st.text_input("Mot de passe *", type="password")
            submit_login = st.form_submit_button("🚀 Se Connecter")

            if submit_login:
                clean_prenom = prenom_login.strip() if prenom_login else ""
                if not clean_prenom or not pwd_login:
                    st.warning("Veuillez remplir tous les champs.")
                else:
                    try:
                        res = supabase.table("profiles").select("*").eq("prenom", clean_prenom).eq("password", pwd_login).execute()
                        if res.data:
                            st.session_state.user = res.data[0]
                            st.query_params["logged_user"] = st.session_state.user["prenom"]
                            st.success(f"Bienvenue {st.session_state.user['prenom']} !")
                            st.rerun()
                        else:
                            st.error("Prénom ou mot de passe incorrect.")
                    except Exception as e:
                        st.error(f"Erreur de connexion à la base de données : {e}")

    with tab2:
        st.subheader("Créer son compte familial")
        with st.form("form_inscription"):
            nom = st.text_input("Le Nom *")
            prenom = st.text_input("Prénom *")
            phone = st.text_input("Le Numéro de téléphone *")
            groupe = st.selectbox(
                "Choisir votre salon familial *", 
                ["Hommes", "Femmes", "Garçons", "Filles", "Petits fils/filles"]
            )
            password = st.text_input("Créer un mot de passe fort *", type="password")
            
            submit_signup = st.form_submit_button("✨ S'inscrire")

            if submit_signup:
                if nom and prenom and phone and password:
                    is_admin = True if prenom.strip().lower() == "eric" else False
                    new_user = {
                        "nom": nom.strip(), 
                        "prenom": prenom.strip(), 
                        "phone": phone.strip(),
                        "groupe": groupe, 
                        "password": password, 
                        "is_admin": is_admin
                    }
                    try:
                        supabase.table("profiles").insert(new_user).execute()
                        st.success("Compte créé avec succès ! Connectez-vous dans l'onglet 'Se Connecter'.")
                    except Exception as e:
                        st.error(f"Erreur lors de l'inscription : Ce numéro existe déjà
