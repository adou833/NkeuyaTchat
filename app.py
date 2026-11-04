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
    "Bleu Nkeuya": "#0084FF",
    "Vert Sombre": "#128C7E"
}
primary_color = theme_colors.get(st.session_state.theme_color, "#075E54")

# ---------------------------------------------------------
# 4. Style CSS personnalisé
# ---------------------------------------------------------
st.markdown(f"""
    <style>
    .stApp {{
        background-color: #ECE5DD;
    }}
    .main .block-container {{
        background-color: #FFFFFF;
        border-radius: 20px;
        padding: 1.5rem 1rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        margin-top: 15px;
        margin-bottom: 15px;
    }}
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
                ["Femmes", "Garçons", "Filles", "Petits fils/filles"]
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

        # --- NOUVEAU : RECHERCHE DE MEMBRES ---
        st.divider()
        st.subheader("🔍 Rechercher un membre")
        search_query = st.text_input("Taper un prénom ou nom...", key="search_member_input")

        # Si l'utilisateur tape une recherche, on filtre les membres
        selected_dm_salon = None
        if search_query:
            try:
                # Recherche insensible à la casse dans Supabase (ou filtrage en Python)
                all_profiles_res = supabase.table("profiles").select("prenom", "nom", "groupe").execute()
                all_profiles = all_profiles_res.data if all_profiles_res.data else []
                
                matched_members = [
                    p for p in all_profiles 
                    if search_query.lower() in p["prenom"].lower() or search_query.lower() in p["nom"].lower()
                ]
                
                if matched_members:
                    st.write(f"Résultats ({len(matched_members)}) :")
                    for m in matched_members:
                        # On évite de se chercher soi-même pour un chat direct
                        if m["prenom"].lower() != user["prenom"].lower():
                            dm_name = f"💬 Chat avec {m['prenom']} {m['nom']}"
                            if st.button(f"👤 {m['prenom']} {m['nom']}", key=f"btn_dm_{m['prenom']}"):
                                st.session_state.active_dm = dm_name
                        else:
                            st.caption(f"• {m['prenom']} {m['nom']} (Vous)")
                else:
                    st.info("Aucun membre trouvé.")
            except Exception:
                st.write("Erreur lors de la recherche.")

        # --- GESTION ET FILTRAGE DES SALONS ---
        st.divider()
        
        # Si un DM a été sélectionné via la recherche, on l'ajoute ou le met en avant
        salons_accessibles = ["Salon : Général", "Salon : Photos de la famille Nkeuya"]
        salons_accessibles.extend([
            "Salon : Femmes",
            "Salon : Garçons",
            "Salon : Filles",
            "Salon : Petits fils/filles"
        ])

        # Si l'utilisateur a cliqué sur un profil pour tchater en privé, on l'ajoute aux choix
        if "active_dm" in st.session_state and st.session_state.active_dm:
            if st.session_state.active_dm not in salons_accessibles:
                salons_accessibles.insert(0, st.session_state.active_dm)
            default_index = 0
        else:
            default_index = 0
            
        salon_choisi = st.selectbox("📌 Choisir un salon / discussion", salons_accessibles, index=default_index, key="select_salon")

        # --- LISTE DES MEMBRES CLASSIQUE ---
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
            if "logged_user" in st.query_params:
                del st.query_params["logged_user"]
            if "active_dm" in st.session_state:
                del st.session_state.active_dm
            st.rerun()

    # --- ESPACE DE CHAT ---
    st.subheader(f"🗣️ {salon_choisi}")

    is_photo_salon = "Photos" in salon_choisi
    can_post = True
    if is_photo_salon and not user.get("is_admin"):
        can_post = False
        st.info("🔒 Ce salon est en lecture seule. Seul l'administrateur (Eric) peut y ajouter des photos.")

    # Affichage des messages depuis Supabase
    try:
        messages_res = supabase.table("messages").select("*").eq("salon", salon_choisi).execute()
        messages = messages_res.data if messages_res.data else []
        
        for msg in messages:
            if not msg.get("is_blocked", False):
                is_me = (msg.get("sender_prenom") == user["prenom"])
                with st.chat_message("user" if not is_me else "assistant"):
                    st.write(f"**{msg.get('sender_prenom', 'Anonyme')}** : {msg.get('content', '')}")
                    if msg.get("file_url"):
                        st.image(msg["file_url"])
    except Exception as e:
        st.info("Espace de discussion initialisé. Aucun message pour le moment.")

    # Zone de saisie des messages
    if can_post:
        st.divider()
        with st.form("form_message", clear_on_submit=True):
            msg_text = st.text_input("💬 Écris ton message ici...", key="input_msg")
            uploaded_file = st.file_uploader("📎 Partager une photo ou un document", type=["png", "jpg", "jpeg", "pdf"], key="file_upload")
            
            col1, col2 = st.columns([1, 4])
            with col1:
                voice_btn = st.form_submit_button("🎙️ Voice")
            with col2:
                send_btn = st.form_submit_button("📤 Envoyer")

            if send_btn and (msg_text or uploaded_file):
                try:
                    supabase.table("messages").insert({
                        "sender_prenom": user["prenom"],
                        "sender_phone": user["phone"],
                        "salon": salon_choisi,
                        "content": msg_text if msg_text else "",
                        "is_blocked": False
                    }).execute()
                    st.rerun()
                except Exception as err:
                    st.error(f"Erreur lors de l'envoi du message : {err}")
            elif voice_btn:
                st.toast("Fonction vocale bientôt active !")

    # --- PANNEAU D'ADMINISTRATION (POUR ERIC) ---
    if user.get("is_admin"):
        with st.expander("🛠️ Panneau d'Administration (Accès Eric)"):
            st.write("Contrôle total de l'application familiale :")
            if st.button("⚙️ Réinitialiser le mot de passe d'un membre", key="admin_pwd"):
                st.info("Module de réinitialisation actif.")
            if st.button("🚫 Gérer les messages indésirables", key="admin_mod"):
                st.info("Module de modération actif.")
