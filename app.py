# --- OUTILS MULTIMÉDIA ET VOCAL ---
        with st.container():
            st.markdown("---")
            media_tab1, media_tab2, media_tab3, media_tab4 = st.tabs([
                "📸 Photo", 
                "📄 Document", 
                "🎵 Fichier Son", 
                "🎙️ Message Vocal"
            ])
            
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
                            st.error(f"Erreur détaillée : {e}")
                    else:
                        st.warning("Veuillez sélectionner une photo.")

            with media_tab2:
                doc_file = st.file_uploader("Choisir un document", type=["pdf", "docx", "txt", "xlsx"], key="doc_uploader")
                doc_caption = st.text_input("Description du document", key="doc_caption_input")
                if st.button("📤 Envoyer le document", key="btn_send_doc"):
                    if doc_file:
                        try:
                            file_bytes = doc_file.getvalue()
                            file_name = f"doc_{int(datetime.now().timestamp())}_{doc_file.name}"
                            supabase.storage.from_("media").upload(file_name, file_bytes)
                            media_url = supabase.storage.from_("media").get_public_url(file_name)
                            
                            nouveau_msg = {
                                "salon": salon_actif,
                                "content": doc_caption if doc_caption else f"📄 Document : {doc_file.name}",
                                "sender_prenom": user["prenom"],
                                "sender_phone": user["phone"],
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "reactions": {},
                                "media_url": media_url,
                                "media_type": "document"
                            }
                            supabase.table("messages").insert(nouveau_msg).execute()
                            st.success("Document envoyé avec succès !")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Erreur détaillée : {e}")
                    else:
                        st.warning("Veuillez sélectionner un document.")

            with media_tab3:
                sound_file = st.file_uploader("Choisir un fichier audio/son", type=["mp3", "wav", "ogg", "m4a"], key="sound_uploader")
                sound_caption = st.text_input("Légende audio (optionnel)", key="sound_caption_input")
                if st.button("📤 Envoyer le son", key="btn_send_sound"):
                    if sound_file:
                        try:
                            file_bytes = sound_file.getvalue()
                            file_name = f"sound_{int(datetime.now().timestamp())}_{sound_file.name}"
                            supabase.storage.from_("media").upload(file_name, file_bytes)
                            media_url = supabase.storage.from_("media").get_public_url(file_name)
                            
                            nouveau_msg = {
                                "salon": salon_actif,
                                "content": sound_caption if sound_caption else f"🎵 Fichier audio : {sound_file.name}",
                                "sender_prenom": user["prenom"],
                                "sender_phone": user["phone"],
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "reactions": {},
                                "media_url": media_url,
                                "media_type": "audio"
                            }
                            supabase.table("messages").insert(nouveau_msg).execute()
                            st.success("Son envoyé avec succès !")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Erreur détaillée : {e}")
                    else:
                        st.warning("Veuillez sélectionner un fichier audio.")

            with media_tab4:
                st.info("🎙️ Enregistrez un message vocal avec votre micro.")
                audio_input_file = st.audio_input("Enregistrer un message vocal")
                
                if audio_input_file is not None:
                    st.audio(audio_input_file)
                    if st.button("📤 Envoyer ce message vocal", key="btn_send_voice"):
                        try:
                            audio_bytes = audio_input_file.getvalue()
                            file_name = f"voice_{int(datetime.now().timestamp())}.wav"
                            supabase.storage.from_("media").upload(file_name, audio_bytes)
                            media_url = supabase.storage.from_("media").get_public_url(file_name)
                            
                            nouveau_msg = {
                                "salon": salon_actif,
                                "content": f"🎙️ Message vocal de {user['prenom']}",
                                "sender_prenom": user["prenom"],
                                "sender_phone": user["phone"],
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "reactions": {},
                                "media_url": media_url,
                                "media_type": "audio"
                            }
                            supabase.table("messages").insert(nouveau_msg).execute()
                            st.success("Message vocal envoyé avec succès !")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Erreur détaillée du vocal : {e}")

        # --- BARRE DE SAISIE DE TEXTE PRINCIPALE ---
        prompt = st.chat_input("Écrivez votre message ici...")
        if prompt:
            nouveau_msg = {
                "salon": salon_actif,
                "content": prompt,
                "sender_prenom": user["prenom"],
                "sender_phone": user["phone"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "reactions": {},
                "media_url": None,
                "media_type": None
            }
            try:
                supabase.table("messages").insert(nouveau_msg).execute()
                st.rerun()
            except Exception as e:
                st.error("Erreur lors de l'envoi du message.")
