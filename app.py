with media_tab4:
                st.info("🎙️ Enregistrez un message vocal avec votre micro.")
                audio_input_file = st.audio_input("Enregistrer un message vocal")
                
                if audio_input_file is not None:
                    # Permet d'écouter l'aperçu du vocal avant l'envoi
                    st.audio(audio_input_file)
                    
                    if st.button("📤 Envoyer ce message vocal", key="btn_send_voice"):
                        try:
                            # Récupération correcte des octets audio
                            audio_bytes = audio_input_file.getvalue()
                            file_name = f"voice_{int(datetime.now().timestamp())}.wav"
                            
                            # Envoi dans le bucket Supabase "media"
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
