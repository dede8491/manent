import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase. Les clés publiables sont lues depuis les variables
 * d'environnement Expo — aucune clé de service, aucune clé d'API vision
 * ne vit dans l'application (cf. src/services/ocr.ts).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '';

let client: SupabaseClient | null = null;

export function hasBackend(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Renvoie le client, ou null si l'app tourne en mode local (V1 : stockage
 * local + comptes, le backend est optionnel tant qu'il n'est pas configuré).
 */
export function supabase(): SupabaseClient | null {
  if (!hasBackend()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Appelle une fonction edge et remonte une erreur lisible en français. */
export async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const sb = supabase();
  if (!sb) throw new Error('Backend non configuré');
  const { data, error } = await sb.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) throw new Error(error.message);
  return data as T;
}
