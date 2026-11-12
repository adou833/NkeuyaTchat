{/* LISTE DES MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-xs italic">
                  Aucun message dans ce salon pour l'instant. Envoyez le premier !
                </div>
              ) : (
                messages.map((msg) => {
                  const author = msg.username || msg.sender;
                  const isMe = author?.toLowerCase() === fullName.toLowerCase();

                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm relative group ${
                          isMe ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                        }`}
                      >
                        {!isMe && (
                          <div className="text-[11px] font-bold text-sky-600 mb-0.5">
                            {author}
                          </div>
                        )}

                        {/* Affichage des médias si présents */}
                        {msg.file_url && (
                          <div className="mb-2">
                            {msg.file_type === 'image' ? (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={msg.file_url}
                                  alt="Média partagé"
                                  className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-95 transition"
                                />
                              </a>
                            ) : msg.file_type === 'audio' ? (
                              <audio controls className="w-full max-h-10">
                                <source src={msg.file_url} />
                                Votre navigateur ne supporte pas l'audio.
                              </audio>
                            ) : msg.file_type === 'video' ? (
                              <video controls className="rounded-lg max-h-48 w-full">
                                <source src={msg.file_url} />
                                Votre navigateur ne supporte pas la vidéo.
                              </video>
                            ) : (
                              <a
                                href={msg.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-sky-600 underline font-semibold flex items-center gap-1"
                              >
                                📎 Télécharger le fichier
                              </a>
                            )}
                          </div>
                        )}

                        <p className="text-xs whitespace-pre-wrap break-words">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[9px] text-gray-400">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(isMe || isAdmin) && (
                            <button
                              onClick={() => handleDeleteMessage(msg)}
                              className="text-[10px] text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 transition cursor-pointer ml-1"
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
