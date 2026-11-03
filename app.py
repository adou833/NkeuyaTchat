import streamlit as st
from supabase import create_client, Client
import bcrypt

# Configuration de la page
st.set_page_config(
    page_title="NkeuyaTchat",
    page_icon="💬",
    layout="centered"
)

# Initialisation sécurisée de Supabase avec gestion des erreurs de démarrage
@st.cache_resource
def get_supabase_client() -> Client:
    try:
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]
        return create_client(url, key)
    except Exception as e:
        st.error(f"Erreur critique de configuration ou de connexion Supabase : {e}")
        st.stop()

# Charger le client de manière sécurisée dès le début
supabase = get_supabase_client()

def main():
    st.title("💬 NkeuyaTchat")
    
    # Gestion propre de la session
    if "user" not in st.session_state:
        st.session_state.user = None

    if not st.session_state.user:
        st.subheader("Connexion à l'espace familial")
        
        with st.form("login_form"):
            username = st.text_input("Nom d'utilisateur")
            password = st.text_input("Mot de passe", type="password")
            submit = st.form_submit_button("Se connecter")
            
            if submit:
                if not username or not password:
                    st.warning("Veuillez remplir tous les champs.")
                else:
                    try:
                        response = supabase.table("users").select("*").eq("username", username).execute()
                        if response.data:
                            user_data = response.data[0]
                            if bcrypt.checkpw(password.encode('utf-8'), user_data['password_hash'].encode('utf-8')):
                                st.session_state.user = user_data
                                st.success("Connexion réussie !")
                                st.rerun()
                            else:
                                st.error("Mot de passe incorrect.")
                        else:
                            st.error("Utilisateur introuvable.")
                    except Exception as err:
                        st.error(f"Erreur de communication avec la base de données : {err}")
    else:
        st.write(f"Bienvenue, **{st.session_state.user['username']}** !")
        if st.button("Se déconnecter"):
            st.session_state.user = None
            st.rerun()

if __name__ == "__main__":
    main()
