import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'manent_session_token';

export async function saveToken(t: string) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(KEY, t); } catch {}
    return;
  }
  await SecureStore.setItemAsync(KEY, t);
}
export async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  return await SecureStore.getItemAsync(KEY);
}
export async function clearToken() {
  if (Platform.OS === 'web') { try { localStorage.removeItem(KEY); } catch {} return; }
  await SecureStore.deleteItemAsync(KEY);
}

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

let cachedToken: string | null = null;
export function setCachedToken(t: string | null) { cachedToken = t; }
export function getCachedToken() { return cachedToken; }

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = cachedToken ?? (await loadToken());
  cachedToken = token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let detail: any = text;
    try { detail = JSON.parse(text); } catch {}
    const err: any = new Error(detail?.detail || `HTTP ${res.status}`);
    err.status = res.status; err.detail = detail;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return (ct.includes('json') ? await res.json() : (await res.text())) as T;
}

export async function uploadImage(uri: string): Promise<{ url: string; key: string }> {
  const token = cachedToken ?? (await loadToken());
  const form = new FormData();
  if (uri.startsWith('data:')) {
    // web
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob as any, 'photo.jpg');
  } else {
    form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  }
  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    body: form,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}`);
  return await res.json();
}
