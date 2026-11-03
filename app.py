with media_tab1:
            photo_file = st.file_uploader("Choisir une photo", type=["png", "jpg", "jpeg"], key="photo_uploader")
            photo_caption = st.text_input("Légende de la photo", key="photo_caption_input")
            if st.button("📤 Envoyer la photo", key="btn_send_photo"):
                if photo_file:
                    try:
                        file_bytes = photo_file.getvalue()
                        file_name = f"photo_{int(datetime.now().timestamp())}_{photo_file.name}"
                        supabase.storage.from_("media").upload(file_name, file_bytes)
                        media_url = supabase.storage.from_("media").get_public_url(file_name)
                        
                        nouveau_msg = {
                            "salon": salon_actif,
                            "content": photo_caption if photo_caption else f"📸 Photo : {photo_file.name}",
                            "sender_prenom": user["prenom"],
                            "sender_phone": user["phone"],
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "reactions": {},
                            "media_url": media_url,
                            "media_type": "image"
                        }
                        supabase.table("messages").insert(nouveau_msg).execute()
                        st.success("Photo envoyée avec succès !")
                        st.rerun()
                    except Exception as e:
                        # 🔍 Affichage de l'erreur exacte pour le diagnostic
                        st.error(f"Erreur détaillée : {e}")
                else:
                    st.warning("Veuillez sélectionner une photo.")
