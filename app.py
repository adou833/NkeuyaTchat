import streamlit as st
from supabase import create_client, Client

st.set_page_config(page_title="NkeuyaTchat", page_icon="💬", layout="centered")

st.title("💬 NkeuyaTchat")
st.write("Bienvenue sur ton application de messagerie connectée à Supabase !")

# Récupération des clés Supabase (via les secrets Streamlit ou directement)
try:
    SUPABASE_URL = st.secrets["SUPABASE_URL"]
    SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
except Exception:
    SUPABASE_URL = ""
    SUPABASE_KEY = ""

# Si les secrets ne sont pas définis, on affiche des champs de saisie pour les tests
if not SUPABASE_URL or not SUPABASE_KEY:
    st.warning("Veuillez configurer vos clés Supabase dans les secrets de Streamlit ou les entrer ci-dessous :")
    SUPABASE_URL = st.text_input("Supabase URL")
    SUPABASE_KEY = st.text_input("Supabase Key", type="password")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Choix du pseudo
    username = st.text_input("Ton pseudo", value="Utilisateur")

    # Formulaire d'envoi de message
    with st.form("chat_form", clear_on_submit=True):
        message_text = st.text_input("Écris ton message ici...")
        submit_button = st.form_submit_button("Envoyer 🚀")

        if submit_button and message_text:
            try:
                # Insertion dans la table 'messages' de Supabase
                supabase.table("messages").insert({"username": username, "content": message_text}).execute()
            except Exception as e:
                st.error(f"Erreur lors de l'envoi : {e}")

    # Affichage du fil de discussion
    st.subheader("Fil de discussion")
    try:
        response = supabase.table("messages").select("*").order("created_at", desc=False).execute()
        messages = response.data

        if messages:
            for msg in messages:
                st.markdown(f"**{msg.get('username', 'Anonyme')}** : {msg.get('content', '')}")
        else:
            st.info("Aucun message pour le moment. Sois le premier à écrire !")
    except Exception as e:
        st.error(f"Erreur lors du chargement des messages (assure-toi d'avoir créé la table 'messages' dans Supabase) : {e}")
else:
    st.info("Entre tes identifiants Supabase pour commencer à utiliser le chat.")
