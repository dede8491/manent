import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Purchases from 'react-native-purchases';
import { useQueryClient } from '@tanstack/react-query';
import { api, loadToken, saveToken, clearToken, setCachedToken } from './api';
import { rcEnabled } from './revenuecat';

type User = {
  user_id: string;
  email: string;
  pseudo: string;
  handle: string;
  picture?: string | null;
  reading_mode?: string | null;
  themes?: string[];
  premium?: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  rcIdentityError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, pseudo: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (u: Partial<User>) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await loadToken();
      if (!token) { setUser(null); return; }
      setCachedToken(token);
      const { user } = await api<{ user: User }>('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
      await clearToken();
      setCachedToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => { await refresh(); setLoading(false); })();
  }, [refresh]);

  // Identité RevenueCat : liaison COMPULSORY au user_id sur chaque chemin d'auth.
  const rcIdentityRef = useRef<string | null>(null);
  const [rcIdentityError, setRcIdentityError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!rcEnabled) return;
    (async () => {
      try {
        if (user?.user_id && rcIdentityRef.current !== user.user_id) {
          const { customerInfo } = await Purchases.logIn(user.user_id);
          rcIdentityRef.current = user.user_id;
          setRcIdentityError(null);
          console.log('[RevenueCat] identity bound:', await Purchases.getAppUserID(), '| original:', customerInfo.originalAppUserId);
        } else if (!user?.user_id && rcIdentityRef.current) {
          await Purchases.logOut();
          rcIdentityRef.current = null;
        }
        queryClient.invalidateQueries({ queryKey: ['revenuecat'] });
      } catch (e) {
        setRcIdentityError(String(e));
      }
    })();
  }, [user?.user_id, queryClient]);

  const signIn = async (email: string, password: string) => {
    const r = await api<{ session_token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await saveToken(r.session_token); setCachedToken(r.session_token);
    setUser(r.user);
  };

  const signUp = async (email: string, password: string, pseudo: string) => {
    const r = await api<{ session_token: string; user: User }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, pseudo }),
    });
    await saveToken(r.session_token); setCachedToken(r.session_token);
    setUser(r.user);
  };

  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    await clearToken(); setCachedToken(null); setUser(null);
  };

  const updateUser = async (patch: Partial<User>) => {
    const r = await api<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify(patch) });
    setUser(r.user);
  };

  return <Ctx.Provider value={{ user, loading, rcIdentityError, signIn, signUp, signOut, refresh, updateUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}
