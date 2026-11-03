with media_tab2:
            doc_file = st.file_uploader("Choisir un document", type=["pdf", "docx", "txt", "xlsx"], key="doc_uploader")
            doc_caption = st.text_input("Description du document", key="doc_caption_input")
            if st.button("📤 Envoyer le document", key="btn_send_doc"):
                if doc_file:
                    try:
                        file_bytes = doc_file.getvalue()
                        file_name = f"doc_{int(datetime.now().timestamp())}_{doc_file.name}"
                        
                        # Détection automatique du type MIME selon l'extension
                        ext = doc_file.name.split('.')[-1].lower()
                        mime_types = {
                            "pdf": "application/pdf",
                            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            "txt": "text/plain"
                        }
                        content_type = mime_types.get(ext, "application/octet-stream")
                        
                        # Upload avec le content-type sécurisé
                        supabase.storage.from_("media").upload(
                            file_name, 
                            file_bytes, 
                            file_options={"content-type": content_type}
                        )
                        
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
