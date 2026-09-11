import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Purchases from 'react-native-purchases';
import { useQueryClient } from '@tanstack/react-query';
import { api, loadToken, saveToken, clearToken, setCachedToken } from './api';
import { rcEnabled } from './revenuecat';
import { registerForPush } from './push';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_CACHE = 'manent_user_cache';

type User = {
  user_id: string;
  email: string;
  pseudo: string;
  handle: string;
  picture?: string | null;
  reading_mode?: string | null;
  themes?: string[];
  premium?: boolean;
  is_premium?: boolean;
  is_admin?: boolean;
  birthdate?: string | null;
  tour_seen?: boolean;
  created_at?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  rcIdentityError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, pseudo: string, birthdate?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (u: Partial<User>) => Promise<void>;
  markSeen: (key: 'tour_seen') => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Reste connectée tant que le jeton est valide : seule une réponse 401 déconnecte. Une erreur réseau
  // (avion, réseau lent au démarrage) garde le jeton et affiche la dernière version connue du profil.
  const refresh = useCallback(async () => {
    const token = await loadToken();
    if (!token) { setUser(null); return; }
    setCachedToken(token);
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      setUser(user);
      AsyncStorage.setItem(USER_CACHE, JSON.stringify(user)).catch(() => {});
    } catch (e: any) {
      if (e?.status === 401) {
        setUser(null);
        await clearToken();
        setCachedToken(null);
        AsyncStorage.removeItem(USER_CACHE).catch(() => {});
        return;
      }
      try {
        const cached = await AsyncStorage.getItem(USER_CACHE);
        if (cached) setUser(JSON.parse(cached));
      } catch {}
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

  // Enregistrement push à chaque connexion / ouverture (les jetons peuvent tourner)
  useEffect(() => {
    if (user?.user_id) registerForPush(user.user_id);
  }, [user?.user_id]);

  const signIn = async (email: string, password: string) => {
    const r = await api<{ session_token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await saveToken(r.session_token); setCachedToken(r.session_token);
    setUser(r.user);
    AsyncStorage.setItem(USER_CACHE, JSON.stringify(r.user)).catch(() => {});
  };

  const signUp = async (email: string, password: string, pseudo: string, birthdate?: string) => {
    const r = await api<{ session_token: string; user: User }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, pseudo, birthdate }),
    });
    await saveToken(r.session_token); setCachedToken(r.session_token);
    setUser(r.user);
    AsyncStorage.setItem(USER_CACHE, JSON.stringify(r.user)).catch(() => {});
  };

  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    await clearToken(); setCachedToken(null); setUser(null);
    AsyncStorage.removeItem(USER_CACHE).catch(() => {});
  };

  const updateUser = async (patch: Partial<User>) => {
    const r = await api<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify(patch) });
    setUser(r.user);
    AsyncStorage.setItem(USER_CACHE, JSON.stringify(r.user)).catch(() => {});
  };

  // Marque une information vue sur le compte (ex. tour de bienvenue) sans re-télécharger le profil
  const markSeen = async (key: 'tour_seen') => {
    setUser(u => (u ? { ...u, [key]: true } : u));
    try { await api('/me/settings', { method: 'PATCH', body: JSON.stringify({ [key]: true }) }); } catch {}
  };

  return <Ctx.Provider value={{ user, loading, rcIdentityError, signIn, signUp, signOut, refresh, updateUser, markSeen }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}
