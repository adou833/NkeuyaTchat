const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedName = loginName.trim();
    const trimmedPassword = loginPassword.trim();
    const isAdminAccount = trimmedName.toLowerCase() === ADMIN_NAME.toLowerCase();

    if (!trimmedName || (!trimmedPassword && !isAdminAccount)) {
      setError('Veuillez entrer votre Prénom et Nom ainsi que votre mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await supabase
        .from('users')
        .select('*')
        .ilike('full_name', trimmedName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (isAdminAccount && !data) {
        window.localStorage.setItem('chat_user', ADMIN_NAME);
        setCurrentUser(ADMIN_NAME);
        void fetchPendingUsers();
        router.replace('/salon/general');
        setLoading(false);
        return;
      }

      if (loginError || !data) {
        setError("Aucun compte trouvé à ce nom. Veuillez d'abord créer votre compte.");
        setLoading(false);
        return;
      }

      if (!isAdminAccount) {
        const storedPassword =
          typeof data.password === 'string' ? data.password.trim() : '';

        if (storedPassword && storedPassword !== trimmedPassword) {
          setError('Mot de passe incorrect.');
          setLoading(false);
          return;
        }
      }

      const isWaiting =
        data.status === 'pending' || data.status === 'en_attente';
      if (isWaiting && !isAdminAccount) {
        setError(
          "Votre demande d'accès est toujours en attente de validation par l'administrateur."
        );
        setLoading(false);
        return;
      }

      if (data.status === 'rejected' || data.status === 'refuse') {
        setError("Votre demande d'accès a été refusée.");
        setLoading(false);
        return;
      }

      const resolvedName = data.full_name?.trim() || trimmedName;
      window.localStorage.setItem('chat_user', resolvedName);
      setCurrentUser(resolvedName);

      if (resolvedName.toLowerCase() === ADMIN_NAME.toLowerCase()) {
        void fetchPendingUsers();
      }
      router.replace('/salon/general');
    } catch {
      setError('Impossible de vérifier le compte pour le moment.');
    } finally {
      setLoading(false);
    }
  };