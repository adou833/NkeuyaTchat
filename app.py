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
# 3. Initialisation de la session et du thème
# ---------------------------------------------------------
if "user" not in st.session_state:
    st.session_state.user = None
if "theme_color" not in st.session_state:
    st.session_state.theme_color = "WhatsApp Classic"

# Couleurs dynamiques selon le thème choisi
theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Bleu Nkeuya": "#0084FF",
    "Vert Sombre": "#128C7E"
}
primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

# ---------------------------------------------------------
# 4. Style CSS personnalisé (Theme WhatsApp & Arrondis)
# ---------------------------------------------------------
st.markdown(f"""
    <style>
    /* Fond général de la page */
    .stApp {{
        background-color: #ECE5DD;
    }}
    
    /* Conteneur principal arrondi */
    .main .block-container {{
        background-color: #FFFFFF;
        border-radius: 20px;
        padding: 1.5rem 1rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        margin-top: 15px;
        margin-bottom: 15px;
    }}
    
    /* En-tête style WhatsApp */
    .main-header {{
        background-color: {primary_color};
        color: white;
        padding: 10px 15px;
        border-radius: 12px;
        text-align: center;
        font-weight: bold;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        margin-bottom: 15px;
    }}
    .main-header h1, .main-header h2 {{
        font-size: 1.2rem !important;
        margin: 0 !important;
        padding: 0 !important;
        color: white !important;
    }}

    /* Boutons arrondis */
    .stButton>button {{
        background-color: {primary_color};
        color: white;
        border-radius: 20px;
        border: none;
        padding: 8px 16px;
        font-weight: bold;
        width: 100%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }}
    .stButton>button:hover {{
        opacity: 0.9;
        color: white;
    }}

    /* Champs de saisie */
    .stTextInput input, .stSelectbox select {{
        border-radius: 18px !important;
    }}
    </style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------
# 5. Interface de Connexion / Inscription
# ---------------------------------------------------------
if not st.session_state.user:
    st.markdown("<div class='main-header'><h1>💬 NkeuyaTchat Familial</h1></div>", unsafe_allow_html=True)
    tab1, tab2 = st.tabs(["🔑 Se Connecter", "📝 Créer son compte"])

    # --- ONGLET 1 : CONNEXION ---
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
                            st.success(f"Bienvenue {st.session_state.user['prenom']} !")
                            st.rerun()
                        else:
                            st.error("Prénom ou mot de passe incorrect.")
                    except Exception as e:
                        st.error(f"Erreur de connexion à la base de données : {e}")

    # --- ONGLET 2 : INSCRIPTION ---
    with tab2:
        st.subheader("Créer son compte familial")
        with st.form("form_inscription"):
            nom = st.text_input("Le Nom *")
            prenom = st.text_input("Prénom *")
            phone = st.text_input("Le Numéro de téléphone *")
            groupe = st.selectbox("Choisir votre salon familial *", ["Femmes", "Hommes", "Filles", "Petits fils et filles"])
            password = st.text_input("Créer un mot de passe fort *", type="password")
            
            submit_signup = st.form_submit_button("✨ S'inscrire")

            if submit_signup:
                if nom and prenom and phone and password:
                    # Attribution automatique du rôle administrateur à Eric
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
                        st.error(f"Erreur lors de l'inscription : Ce numéro existe déjà ou la table pose problème. ({e})")
                else:
                    st.warning("Tous les champs sont obligatoires.")

# ---------------------------------------------------------
# 6. Interface Principale (Utilisateur Connecté)
# ---------------------------------------------------------
else:
    user = st.session_state.user
    st.markdown(f"<div class='main-header'><h2>💬 NkeuyaTchat - Salut {user['prenom']} !</h2></div>", unsafe_allow_html=True)

    # --- BARRE LATÉRALE (SIDEBAR) ---
    with st.sidebar:
        st.write(f"👤 **{user['prenom']} {user['nom']}**")
        if user.get("is_admin"):
            st.markdown("⭐ **ADMINISTRATEUR (Eric)**")
        
        st.divider()
        st.subheader("🎨 Thème WhatsApp")
        st.session_state.theme_color = st.radio("Couleur :", ["WhatsApp Classic", "Bleu Nkeuya", "Vert Sombre"], key="theme_radio")

        # --- GESTION ET FILTRAGE DES SALONS ---
        st.divider()
        salons_accessibles = ["Salon : Général", "Salon : Photos de la famille Nkeuya"]
        groupe_usr = user.get("groupe", "")
        if groupe_usr == "Femmes":
            salons_accessibles.append("Salon : Femmes")
        elif groupe_usr == "Hommes":
            salons_accessibles.append("Salon : Hommes")
        elif groupe_usr == "Filles":
            salons_accessibles.append("Salon : Filles")
        elif groupe_usr == "Petits fils et filles":
            salons_accessibles.append("Salon : Petits fils et filles")
            
        salon_choisi = st.selectbox("📌 Choisir un salon", salons_accessibles, key="select_salon")

        # --- LISTE DES MEMBRES ---
        st.divider()
        with st.expander("👥 Membres de la Famille"):
            try:
                profiles_res = supabase.table("profiles").select("prenom", "nom", "groupe").execute()
                profiles = profiles_res.data if profiles_res.data else []
                for p in profiles:
                    st.write(f"• **{p['prenom']} {p['nom']}** ({p['groupe']})")
            except Exception:
                st.write("Chargement des membres...")

        st.divider()
        if st.button("🚪 Déconnexion Complète", key="btn_logout"):
            st.session_state.user = None
            st.rerun()

    # --- ESPACE DE CHAT ---
    st.subheader(f"🗣️ {salon_choisi}")

    is_photo_salon = "Photos" in salon_choisi
    can_post = True
    if is_photo_salon and not user.get("is_admin"):
        can_post = False
        st.info("🔒 Ce salon est en lecture seule. Seul l
