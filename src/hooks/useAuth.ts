import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated, isReadOnly, login as apiLogin, logout as apiLogout } from '@/lib/api';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const [readOnly, setReadOnly] = useState(() => isReadOnly());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const login = useCallback(async (password: string, email?: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiLogin(password, email);
      setReadOnly(isReadOnly());
      setAuthenticated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setAuthenticated(false);
  }, []);

  return { authenticated, readOnly, loading, error, login, logout };
}
