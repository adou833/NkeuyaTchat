import streamlit as st
from supabase import create_client, Client
import bcrypt
import time

# ---------------------------------------------------------
# 1. Configuration de la page
# ---------------------------------------------------------
st.set_page_config(
    page_title="NkeuyaTchat",
    page_icon="💬",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# ---------------------------------------------------------
# 2. Thème CSS personnalisé - Style "Bleu Nkeuya / WhatsApp"
# ---------------------------------------------------------
st.markdown("""
    <style>
    /* Fond principal sombre Bleu Nkeuya */
    .stApp {
        background-color: #0b141a;
        color: #e9edef;
    }
    
    /* Bandeau supérieur style WhatsApp */
    .header-bar {
        background-color: #202c33;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 20px;
        text-align: center;
        border-bottom: 3px solid #00a884;
    }
    .header-title {
        color: #00a884;
        font-size: 26px;
        font-weight: bold;
        margin: 0;
    }
    .header-subtitle {
        color: #8696a0;
        font-size: 13px;
        margin-top: 4px;
    }

    /* Bulles de message */
    .chat-bubble-sent {
        background-color: #005c4b;
        color: #e9edef;
        padding: 10px 14px;
        border-radius: 12px 12px 2px 12px;
        margin-bottom: 8px;
        max-width: 80%;
        margin-left: auto;
    }
    .chat-bubble-received {
        background-color: #202c33;
        color: #e9edef;
        padding: 10px 14px;
        border-radius: 12px 12px 12px 2px;
        margin-bottom: 8px;
        max-width: 80%;
        margin-right: auto;
    }
    
    /* Input & Boutons */
    .stTextInput > div > div > input {
        background-color: #2a3942 !important;
        color: #e9edef !important;
        border-radius: 8px !important;
        border: 1px solid #3b4a54 !important;
    }
    .stButton > button {
        background-color: #00a884 !important;
        color: #111b21 !important;
        font-weight: bold !important;
        border-radius: 8px !important;
        border: none !important;
        width: 100%;
    }
    .stButton > button:hover {
        background-color: #029071 !important;
        color: #ffffff !important;
    }
    </style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------
# 3. Connexion sécurisée à Supabase (Evite les crashs au démarrage)
# ---------------------------------------------------------
@st.cache_resource
def get_supabase_client() -> Client:
    try:
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]
        return create_client(url, key)
    except Exception as e:
        st.error(f"Erreur de connexion aux secrets Supabase : {e}")
        st.stop()

supabase = get_supabase_client()

# ---------------------------------------------------------
# 4. En-tête (Bandeau Style WhatsApp)
# ---------------------------------------------------------
st.markdown("""
    <div class="header-bar">
        <div class="header-title">💬 NkeuyaTchat</div>
        <div class="header-subtitle">Espace de discussion privé & sécurisé pour la famille</div>
    </div>
""", unsafe_allow_html=True)

# Initialisation de la session
if "user" not in st.session_state:
    st.session_state.user = None

# ---------------------------------------------------------
# 5. Interface Connexion / Inscription
# ---------------------------------------------------------
if not st.session_state.user:
    tab_login, tab_register = st.tabs(["🔐 Connexion", "📝 Inscription"])

    # --- ONGLET 1 : CONNEXION ---
    with tab_login:
        with st.form("login_form"):
            username = st.text_input("Nom d'utilisateur")
            password = st.text_input("Mot de passe", type="password")
            submit_login = st.form_submit_button("Se connecter")

            if submit_login:
                if not username or not password:
                    st.warning("Veuillez remplir tous les champs.")
                else:
                    try:
                        res = supabase.table("users").select("*").eq("username", username).execute()
                        if res.data:
                            user_data = res.data[0]
                            # Vérification du mot de passe haché avec bcrypt
                            if bcrypt.checkpw(password.encode('utf-8'), user_data['password_hash'].encode('utf-8')):
                                st.session_state.user = user_data
                                st.success("Connexion réussie !")
                                time.sleep(0.5)
                                st.rerun()
                            else:
                                st.error("Mot de passe incorrect.")
                        else:
                            st.error("Utilisateur non trouvé.")
                    except Exception as err:
                        st.error(f"Erreur lors de la connexion : {err}")

    # --- ONGLET 2 : INSCRIPTION ---
    with tab_register:
        with st.form("register_form"):
            new_username = st.text_input("Choisissez un nom d'utilisateur")
            new_password = st.text_input("Choisissez un mot de passe", type="password")
            confirm_password = st.text_input("Confirmez le mot de passe", type="password")
            submit_register = st.form_submit_button("Créer un compte")

            if submit_register:
                if not new_username or not new_password or not confirm_password:
                    st.warning("Veuillez remplir tous les champs.")
                elif new_password != confirm_password:
                    st.error("Les mots de passe ne correspondent pas.")
                else:
                    try:
                        # Vérifier si l'utilisateur existe déjà
                        check_user = supabase.table("users").select("username").eq("username", new_username).execute()
                        if check_user.data:
                            st.error("Ce nom d'utilisateur est déjà pris.")
                        else:
                            # Hachage du mot de passe
                            hashed_pw = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                            
                            # Insertion dans Supabase
                            new_user_payload = {
                                "username": new_username,
                                "password_hash": hashed_pw,
                                "is_admin": False
                            }
                            supabase.table("users").insert(new_user_payload).execute()
                            st.success("Compte créé avec succès ! Vous pouvez maintenant vous connecter.")
                    except Exception as err:
                        st.error(f"Erreur lors de l'inscription : {err}")

# ---------------------------------------------------------
# 6. Espace de Discussion (Connecté)
# ---------------------------------------------------------
else:
    # Barre supérieure avec utilisateur et bouton de déconnexion
    col_usr, col_btn = st.columns([3, 1])
    with col_usr:
        st.markdown(f"Connecté en tant que **{st.session_state.user['username']}**")
    with col_btn:
        if st.button("Déconnexion"):
            st.session_state.user = None
            st.rerun()

    st.divider()

    # Zone de messages (Exemple de rendu visuel avec bulles)
    st.subheader("💬 Salon de discussion")

    try:
        # Chargement des messages depuis Supabase (limité aux 30 derniers)
        msgs_res = supabase.table("messages").select("*").order("created_at", desc=False).limit(30).execute()
        messages = msgs_res.data if msgs_res.data else []

        for msg in messages:
            sender = msg.get("sender", "Anonyme")
            content = msg.get("content", "")
            
            if sender == st.session_state.user['username']:
                st.markdown(f"""
                    <div class="chat-bubble-sent">
                        <small style="color: #8696a0;">Moi</small><br>{content}
                    </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                    <div class="chat-bubble-received">
                        <small style="color: #00a884; font-weight:bold;">{sender}</small><br>{content}
                    </div>
                """, unsafe_allow_html=True)

    except Exception as e:
        st.info("Aucun message à afficher ou table messages non configurée.")

    # Zone de saisie d'un nouveau message
    st.divider()
    with st.form("send_msg_form", clear_on_submit=True):
        input_content = st.text_input("Écrire un message...", placeholder="Tapez votre message ici...")
        send_btn = st.form_submit_button("Envoyer 📩")

        if send_btn and input_content:
            try:
                supabase.table("messages").insert({
                    "sender": st.session_state.user['username'],
                    "content": input_content
                }).execute()
                st.rerun()
            except Exception as e:
                st.error(f"Erreur d'envoi : {e}")

    # Section Administrateur (Si le compte est admin)
    if st.session_state.user.get('is_admin', False):
        st.sidebar.divider()
        st.sidebar.subheader("👑 Espace Administrateur")
        st.sidebar.write("Tableau de bord de gestion NkeuyaTchat")
