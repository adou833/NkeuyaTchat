import streamlit as st
from supabase import create_client, Client

# Configuration de la page
st.set_page_config(page_title="NkeuyaTchat", page_icon="💬", layout="centered")

# Connexion Supabase via Streamlit Secrets
@st.cache_resource
def init_supabase():
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)

supabase = init_supabase()

# Initialisation des variables de session
if "user" not in st.session_state:
    st.session_state.user = None
if "theme_color" not in st.session_state:
    st.session_state.theme_color = "WhatsApp Classic"

# --- PERSONNALISATION COULEURS WHATSAPP (CORRIGÉ) ---
theme_colors = {
    "WhatsApp Classic": "#075E54",
    "Vert Sombre": "#128C7E",  # Vert sombre corrigé
    "Bleu Nkeuya": "#0084FF"   # Bleu corrigé
}
primary_color = theme_colors[st.session_state.theme_color]

st.markdown(f"""
    <style>
    .stApp {{ background-color: #ECE5DD; }}
    .main-header {{ background-color: {primary_color}; color: white; padding: 15px; border-radius: 10px; text-align: center; }}
    .stButton>button {{ background-color: {primary_color}; color: white; border-radius: 20px; }}
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
            res = supabase.table("profiles").select("*").eq("prenom", prenom_login).eq("password", pwd_login).execute()
            if res.data:
                st.session_state.user = res.data[0]
                st.success(f"Bienvenue {st.session_state.user['prenom']} !")
                st.rerun()
            else:
                st.error("Prénom ou mot de passe incorrect.")

    with tab2:
        st.subheader("CREER SON COMPTE")
        nom = st.text_input("Le Nom *", key="signup_nom")
        prenom = st.text_input("Prénom *", key="signup_prenom")
        phone = st.text_input("Le Numéro de téléphone *", key="signup_phone")
        groupe = st.selectbox("Choisir votre salon familial *", ["Femmes", "Hommes", "Filles", "Petits fils et filles"], key="signup_groupe")
        password = st.text_input("Créer un mot de passe fort *", type="password", key="signup_pwd")
        
        # Eric est Administrateur automatique
        is_admin = True if prenom.strip().lower() == "eric" else False

        if st.button("✨ S'inscrire", key="btn_signup"):
            if nom and prenom and phone and password:
                new_user = {
                    "nom": nom, "prenom": prenom, "phone": phone,
                    "groupe": groupe, "password": password, "is_admin": is_admin
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
        st.session_state.theme_color = st.radio("Couleur :", ["WhatsApp Classic", "Vert Sombre", "Bleu Nkeuya"], key="theme_radio")

        st.divider()
        # Salons autorisés
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

        st.divider()
        if st.button("🚪 Déconnexion Complète", key="btn_logout"):
            st.session_state.user = None
            st.rerun()

    # --- ESPACE DE CHAT ---
    st.subheader(f"🗣️ {salon_choisi}")

    # Mode Lecture Seule pour le salon Photo si non admin
    is_photo_salon = "Photos" in salon_choisi
    can_post = True
    if is_photo_salon and not user.get("is_admin"):
        can_post = False
        st.info("🔒 Ce salon est en lecture seule. Seul l'administrateur (Eric) peut y ajouter des photos.")

    # Affichage des messages
    messages = supabase.table("messages").select("*").eq("salon", salon_choisi).eq("is_blocked", False).execute().data
    for msg in messages:
        with st.chat_message("user" if msg["sender_prenom"] != user["prenom"] else "assistant"):
            st.write(f"**{msg['sender_prenom']}** : {msg['content']}")
            if msg.get("file_url"):
                st.image(msg["file_url"])

    # Zone de saisie
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

    # --- PANNEAU D'ADMINISTRATION (POUR ERIC) ---
    if user.get("is_admin"):
        with st.expander("🛠️ Panneau d'Administration (Accès Eric)"):
            st.write("Contrôle total de l'application familial :")
            if st.button("⚙️ Réinitialiser le mot de passe d'un membre", key="admin_pwd"):
                st.info("Module de réinitialisation actif.")
            if st.button("🚫 Gérer les messages indésirables", key="admin_mod"):
                st.info("Module de modération actif.")
