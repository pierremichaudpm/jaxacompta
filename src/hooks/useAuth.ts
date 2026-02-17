import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated, login as apiLogin, logout as apiLogout } from '@/lib/api';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiLogin(password);
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

  return { authenticated, loading, error, login, logout };
}
