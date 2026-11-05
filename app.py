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
                        st.error(f"Erreur lors de l'inscription : Ce numéro existe déjà ou la table pose problème. ({e})")
                else:
                    st.warning("Tous les champs sont obligatoires.")

# ---------------------------------------------------------
# 6. Interface Principale (Utilisateur Connecté)
# ---------------------------------------------------------
else:
    user = st.session_state.user
    
    if "show_menu" not in st.session_state:
        st.session_state.show_menu = False

    # En-tête : Titre à gauche, et bouton Streamlit natif "⋮" à droite
    col_t, col_b = st.columns([6, 1])
    with col_t:
        st.markdown(f"<div class='whatsapp-app-title'>NkeuyaTchat</div>", unsafe_allow_html=True)
    with col_b:
        if st.button("⋮", key="toggle_menu_btn"):
            st.session_state.show_menu = not st.session_state.show_menu
            st.rerun()

    # Panneau d'options (Menu déroulant intégré)
    if st.session_state.show_menu:
        with st.container():
            st.markdown(f"""
                <div style="background-color: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 10px;">
                    <b>👤 {user['prenom']} {user['nom']}</b>
            """, unsafe_allow_html=True)
            
            is_user_admin = user.get("is_admin") or user.get("prenom", "").strip().lower() == "eric"
            if is_user_admin:
                st.markdown("⭐ **ADMINISTRATEUR (Eric)**")
                st.divider()
                st.markdown("🛠️ **Panneau d'administration**")
                if st.button("⚙️ Réinitialiser les données", key="admin_pwd_gen_menu"):
                    st.info("Action d'administration active.")

            st.divider()
            st.subheader("🎨 Thème WhatsApp")
            st.session_state.theme_color = st.radio("Couleur :", ["WhatsApp Classic", "Bleu Nkeuya", "Vert Sombre"], key="theme_radio_popover")

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
            if st.button("🚪 Déconnexion Complète", key="btn_logout_popover"):
                st.session_state.user = None
                st.session_state.show_menu = False
                if "logged_user" in st.query_params:
                    del st.query_params["logged_user"]
                if "active_dm" in st.session_state:
                    del st.session_state.active_dm
                st.rerun()
            
            if st.button("✖️ Fermer le menu", key="close_menu_btn"):
                st.session_state.show_menu = False
                st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)

    search_query = st.text_input("🔍 Rechercher un membre", key="search_member_main")

    if "chat_filter" not in st.session_state:
        st.session_state.chat_filter = "Général"

    # Barre de navigation avec l'onglet Télécharger placé après Vidéo
    selected_filter = st.radio(
        "Navigation",
        ["💬 Général", "📬 Non Lues", "⭐ Favoris", "📌 Salons", "📞 Appels", "📹 Vidéo", "📥 Télécharger"],
        horizontal=True,
        label_visibility="collapsed"
    )

    if selected_filter == "💬 Général":
        st.session_state.chat_filter = "Général"
    elif selected_filter == "📬 Non Lues":
        st.session_state.chat_filter = "Non Lues"
    elif selected_filter == "⭐ Favoris":
        st.session_state.chat_filter = "Favoris"
    elif selected_filter == "📌 Salons":
        if st.session_state.chat_filter != "Salons":
            st.session_state.chat_filter = "Salons"
            st.session_state.is_chatting_in_salon = False
    elif selected_filter == "📞 Appels":
        st.session_state.chat_filter = "Appels"
    elif selected_filter == "📹 Vidéo":
        st.session_state.chat_filter = "Vidéo"
    elif selected_filter == "📥 Télécharger":
        st.session_state.chat_filter = "Télécharger"

    salons_accessibles = ["Photos de la famille Nkeuya"]
    groupe_usr = user.get("groupe", "")
    if groupe_usr == "Hommes":
        salons_accessibles.append("Hommes")
    elif groupe_usr == "Femmes":
        salons_accessibles.append("Femmes")
    elif groupe_usr == "Garçons":
        salons_accessibles.append("Garçons")
    elif groupe_usr == "Filles":
        salons_accessibles.append("Filles")
    elif groupe_usr == "Petits fils/filles":
        salons_accessibles.append("Petits fils/filles")

    if "active_dm" in st.session_state and st.session_state.active_dm:
        if st.session_state.active_dm not in salons_accessibles:
            salons_accessibles.insert(0, st.session_state.active_dm)

    if search_query:
        try:
            all_profiles_res = supabase.table("profiles").select("prenom", "nom", "groupe").execute()
            all_profiles = all_profiles_res.data if all_profiles_res.data else []
            
            matched_members = [
                p for p in all_profiles 
                if search_query.lower() in p["prenom"].lower() or search_query.lower() in p["nom"].lower()
            ]
            
            if matched_members:
                st.write(f"**Résultats de recherche ({len(matched_members)}) :**")
                cols = st.columns(min(len(matched_members), 3))
                for idx, m in enumerate(matched_members):
                    if m["prenom"].lower() != user["prenom"].lower():
                        col_idx = idx % len(cols)
                        with cols[col_idx]:
                            if st.button(f"💬 {m['prenom']} {m['nom']}", key=f"btn_dm_{m['prenom']}"):
                                st.session_state.active_dm = f"Chat avec {m['prenom']} {m['nom']}"
                                st.session_state.chat_filter = "Salons"
                                st.session_state.salon_actif = st.session_state.active_dm
                                st.session_state.is_chatting_in_salon = True
                                st.rerun()
                    else:
                        with cols[idx % len(cols)]:
                            st.caption(f"• {m['prenom']} (Vous)")
            else:
                st.info("Aucun membre trouvé.")
        except Exception:
            st.warning("Erreur lors de la recherche des membres.")

    st.divider()

    # ---------------------------------------------------------
    # Fonction d'affichage des messages (Flux de chat avec lecteurs intégrés)
    # ---------------------------------------------------------
    def render_chat_stream(salon_name):
        st.subheader(f"💬 {salon_name}" if salon_name == "Général" else f"🗣️ {salon_name}")
        
        try:
            messages_res = supabase.table("messages").select("*").eq("salon", salon_name).execute()
            messages = messages_res.data if messages_res.data else []
        except Exception:
            messages = []

        # Conteneur des messages textuels
        html_msgs = '<div class="whatsapp-chat-box">'
        if messages:
            for msg in messages:
                if not msg.get("is_blocked", False):
                    sender = msg.get('sender_prenom', 'Anonyme')
                    content = msg.get('content', '')
                    media_url = msg.get('media_url', None)
                    
                    html_msgs += f'''
                    <div style="margin-bottom: 8px; max-width: 85%; background-color: #FFFFFF; padding: 8px 12px; border-radius: 8px; box-shadow: 0 1px 1px rgba(0,0,0,0.1); font-size: 0.9rem;">
                        <b style="color: {primary_color}; font-size: 0.8rem;">{sender}</b><br>
                        <span style="color: #333333;">{content}</span>
                    '''
                    if media_url:
                        html_msgs += f'<br><small style="color: #075E54;">📎 [Média joint ci-dessous]</small>'
                    html_msgs += '</div>'
        else:
            html_msgs += '<p style="text-align: center; color: #888; font-size: 0.85rem;">Aucun message pour le moment.</p>'
        html_msgs += '</div>'

        chat_css_html = f"""
        <style>
            .whatsapp-chat-box {{
                height: 220px;
                overflow-y: auto;
                padding: 10px;
                background-color: transparent;
                display: flex;
                flex-direction: column;
                scrollbar-width: thin;
            }}
            .whatsapp-chat-box::-webkit-scrollbar {{
                width: 4px;
            }}
            .whatsapp-chat-box::-webkit-scrollbar-thumb {{
                background-color: rgba(0,0,0,0.2);
                border-radius: 4px;
            }}
        </style>
        {html_msgs}
        <script>
            var box = document.querySelector('.whatsapp-chat-box');
            if(box) {{ box.scrollTop = box.scrollHeight; }}
        </script>
        """
        st.components.v1.html(chat_css_html, height=235, scrolling=False)

        # Affichage direct des lecteurs multimédias (MP3, Vidéos, Images) intégrés sous forme de messages natifs
        if messages:
            for msg in messages:
                media_url = msg.get('media_url')
                if media_url and not msg.get("is_blocked", False):
                    sender = msg.get('sender_prenom', 'Anonyme')
                    st.markdown(f"🔊 **{sender} a partagé un média :**")
                    if media_url.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a')):
                        st.audio(media_url)
                    elif media_url.lower().endswith(('.mp4', '.mov')):
                        st.video(media_url)
                    elif media_url.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                        st.image(media_url, width=250)
                    st.divider()

    # ---------------------------------------------------------
    # GESTION DES AFFICHAGES SELON L'ONGLET ACTIF
    # ---------------------------------------------------------
    
    # 1. ONGLET : GÉNÉRAL
    if st.session_state.chat_filter == "Général":
        render_chat_stream("Général")

        with st.form("form_message_general", clear_on_submit=True):
            msg_text = st.text_input("💬 **Écris ton message ici...**", key="input_msg_general")
            send_btn = st.form_submit_button("📤 Envoyer")

            if send_btn and msg_text:
                try:
                    supabase.table("messages").insert({
                        "sender_prenom": user["prenom"],
                        "sender_phone": user["phone"],
                        "salon": "Général",
                        "content": msg_text,
                        "is_blocked": False
                    }).execute()
                    st.rerun()
                except Exception as err:
                    st.error(f"Erreur : {err}")

    # 2. ONGLET : NON LUES
    elif st.session_state.chat_filter == "Non Lues":
        st.subheader("📬 Messages non lus")
        try:
            unread_messages = []
            tous_les_salons = ["Général", "Photos de la famille Nkeuya", "Hommes", "Femmes", "Garçons", "Filles", "Petits fils/filles"]
            for s in tous_les_salons:
                res = supabase.table("messages").select("*").eq("salon", s).execute()
                if res.data:
                    for m in res.data:
                        if m.get("sender_prenom") != user["prenom"] and not m.get("is_blocked", False):
                            m["current_salon"] = s
                            unread_messages.append(m)
            
            if unread_messages:
                for msg in unread_messages:
                    sender = msg.get('sender_prenom', 'Anonyme')
                    salon_tag = f"📂 *{msg.get('current_salon')}*"
                    st.markdown(f"{salon_tag} - **{sender}** : {msg.get('content', '')}")
                    if msg.get('media_url'):
                        if msg.get('media_url').endswith(('.mp3', '.wav', '.ogg', '.m4a')):
                            st.audio(msg.get('media_url'))
                    st.divider()
            else:
                st.info("Aucun nouveau message non lu.")
        except Exception:
            st.info("Vérification...")

    # 3. ONGLET : FAVORIS
    elif st.session_state.chat_filter == "Favoris":
        st.subheader("⭐ Vos Favoris")
        
        if "favoris_list" not in st.session_state:
            st.session_state.favoris_list = []

        with st.form("form_add_favori", clear_on_submit=True):
            new_fav = st.text_input("➕ Ajouter...")
            add_fav_btn = st.form_submit_button("Enregistrer")
            if add_fav_btn and new_fav:
                st.session_state.favoris_list.append(new_fav)
                st.success("Ajouté !")

        if st.session_state.favoris_list:
            for idx, fav in enumerate(st.session_state.favoris_list):
                col_f1, col_f2 = st.columns([5, 1])
                with col_f1:
                    st.write(f"⭐ {fav}")
                with col_f2:
                    if st.button("❌", key=f"del_fav_{idx}"):
                        st.session_state.favoris_list.pop(idx)
                        st.rerun()
        else:
            st.info("Aucun favori.")

    # 4. ONGLET : APPELS
    elif st.session_state.chat_filter == "Appels":
        st.subheader("📞 Appels Audio")
        st.info("En cours de configuration.")

    # 5. ONGLET : VIDÉO
    elif st.session_state.chat_filter == "Vidéo":
        st.subheader("📹 Appels Vidéo")
        st.info("En cours de configuration.")

    # 6. ONGLET : TÉLÉCHARGER (Envoi direct de fichiers vers les messages du chat)
    elif st.session_state.chat_filter == "Télécharger":
        st.subheader("📥 Partager un média (MP3, Image, Vidéo)")
        
        with st.form("form_upload_tab", clear_on_submit=True):
            uploaded_file_tab = st.file_uploader("📂 Choisir un fichier", type=["png", "jpg", "pdf", "mp3", "wav", "mp4"], key="file_upload_tab")
            target_salon = st.selectbox("📌 Choisir le salon de destination", ["Général"] + salons_accessibles)
            caption_file = st.text_input("💬 Ajouter une légende (optionnel)", key="input_file_caption")
            send_file_btn = st.form_submit_button("📤 Envoyer dans le chat")

            if send_file_btn:
                if uploaded_file_tab is not None:
                    try:
                        file_name = uploaded_file_tab.name
                        file_bytes = uploaded_file_tab.getvalue()
                        
                        storage_path = f"uploads/{file_name}"
                        supabase.storage.from_("media").upload(
                            path=storage_path,
                            file=file_bytes,
                            file_options={"upsert": "true"}
                        )
                        
                        public_url = supabase.storage.from_("media").get_public_url(storage_path)

                        # Enregistrement direct dans le flux des messages de la table messages
                        supabase.table("messages").insert({
                            "sender_prenom": user["prenom"],
                            "sender_phone": user["phone"],
                            "salon": target_salon,
                            "content": caption_file if caption_file else f"Fichier partagé : {file_name}",
                            "media_url": public_url,
                            "is_blocked": False
                        }).execute()
                        
                        st.success(f"Fichier partagé avec succès dans '{target_salon}' ! Rendez-vous dans le salon pour l'écouter.")
                        st.rerun()
                    except Exception as err:
                        st.error(f"Erreur lors de l'envoi du fichier : {err}")
                else:
                    st.warning("Veuillez sélectionner un fichier avant d'envoyer.")

    # 7. ONGLET : SALONS
    else:
        if "salon_actif" not in st.session_state:
            st.session_state.salon_actif = salons_accessibles[0] if salons_accessibles else ""

        if "is_chatting_in_salon" not in st.session_state:
            st.session_state.is_chatting_in_salon = False

        if not st.session_state.is_chatting_in_salon:
            st.subheader("📌 Salons Disponibles")
            for salon in salons_accessibles:
                if st.button(f"💬 {salon}", key=f"btn_salon_list_{salon}"):
                    st.session_state.salon_actif = salon
                    st.session_state.is_chatting_in_salon = True
                    st.rerun()
        else:
            if st.button("⬅️ Retour"):
                st.session_state.is_chatting_in_salon = False
                st.rerun()

            salon_choisi = st.session_state.salon_actif
            is_photo_salon = ("Photos" in salon_choisi)
            can_post = True
            if is_photo_salon and not user.get("is_admin"):
                can_post = False
                st.info("🔒 Lecture seule.")

            render_chat_stream(salon_choisi)

            if can_post:
                with st.form("form_message", clear_on_submit=True):
                    msg_text = st.text_input("💬 **Écris ton message...**", key="input_msg")
                    send_btn = st.form_submit_button("📤 Envoyer")

                    if send_btn and msg_text:
                        try:
                            supabase.table("messages").insert({
                                "sender_prenom": user["prenom"],
                                "sender_phone": user["phone"],
                                "salon": salon_choisi,
                                "content": msg_text,
                                "is_blocked": False
                            }).execute()
                            st.rerun()
                        except Exception as err:
                            st.error(f"Erreur : {err}")
