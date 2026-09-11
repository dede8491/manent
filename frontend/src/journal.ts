// Journal de lecture — types, échelle d'humeur, brouillon local et file hors ligne.
//
// Hors ligne : une entrée qui ne part pas (réseau absent) est mise dans une file locale (`manent_journal_outbox`)
// avec un `client_id` unique ; elle est rejouée au prochain retour de réseau (ouverture de l'app, retour au premier
// plan, accueil). Le serveur ignore les doublons grâce au client_id. Le brouillon en cours survit à la fermeture.
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/src/api';

export type Mood = { value: number; key: string; label: string; color: string };
export const MOODS: Mood[] = [
  { value: 1, key: 'lourd', label: 'Lourd', color: '#957662' },
  { value: 2, key: 'trouble', label: 'Troublé', color: '#C9A98F' },
  { value: 3, key: 'calme', label: 'Calme', color: '#A9C4D6' },
  { value: 4, key: 'porte', label: 'Porté', color: '#79A3C3' },
  { value: 5, key: 'ebloui', label: 'Ébloui', color: '#3A2119' },
];
export const moodOf = (v?: number | null) => MOODS.find(m => m.value === v);

export type EntryBook = { book_id?: string; title?: string; author?: string; cover?: string | null; type?: string };
export type Entry = {
  entry_id: string; book_id: string; date: string; page?: number | null; chapter?: number | null;
  content: string; mood?: number | null; quote_ids: string[]; prompt_id?: string | null; prompt_text?: string | null;
  is_public: boolean; created_at: string; updated_at?: string;
  book?: EntryBook; quotes?: { quote_id: string; text: string; page?: number | null }[]; mood_info?: Mood | null;
  pending?: boolean; client_id?: string;
};
export type Prompt = { prompt_id: string; text: string; category?: string | null };
export type Quota = { used: number; limit: number | null; remaining: number | null; blocked: boolean };
export type JournalHome = {
  current_book: any | null; books_in_progress: number; latest_entry: Entry | null; streak: number; active_days_week: number;
  entries_total: number; prompt: Prompt | null; quota: Quota; is_premium: boolean;
};

export type Draft = {
  client_id: string; book_id: string; date: string; page?: number | null; chapter?: number | null;
  content: string; mood?: number | null; quote_ids: string[]; prompt_id?: string | null; prompt_text?: string | null; is_public: boolean;
};

const OUTBOX_KEY = 'manent_journal_outbox';
const DRAFT_KEY = 'manent_journal_draft';

export function localDateKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function newClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- brouillon
export async function loadDraft(): Promise<Draft | null> {
  try { const raw = await AsyncStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function saveDraft(d: Draft | null): Promise<void> {
  try { if (d) await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
}

// ---------------------------------------------------------------- file hors ligne
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => { try { l(); } catch {} });

export async function readOutbox(): Promise<Draft[]> {
  try { const raw = await AsyncStorage.getItem(OUTBOX_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
async function writeOutbox(items: Draft[]) {
  try { await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items)); } catch {}
  notify();
}

const isNetworkError = (e: any) => !e || typeof e.status !== 'number';

/** Envoie une entrée ; si le réseau manque, la met en file et renvoie { queued: true }. Les erreurs serveur (quota…) remontent. */
export async function submitEntry(d: Draft): Promise<{ entry?: Entry; queued: boolean }> {
  try {
    const entry = await api<Entry>('/journal/entries', { method: 'POST', body: JSON.stringify(d) });
    return { entry, queued: false };
  } catch (e: any) {
    if (!isNetworkError(e)) throw e;
    const box = await readOutbox();
    if (!box.some(x => x.client_id === d.client_id)) await writeOutbox([...box, d]);
    return { queued: true };
  }
}

let flushing = false;
/** Rejoue la file. Une entrée refusée par le serveur (400/402/404) est retirée pour ne pas bloquer les suivantes. */
export async function flushOutbox(): Promise<{ sent: number; remaining: number; rejected: Draft[] }> {
  if (flushing) return { sent: 0, remaining: (await readOutbox()).length, rejected: [] };
  flushing = true;
  let sent = 0; const rejected: Draft[] = [];
  try {
    let box = await readOutbox();
    for (const d of [...box]) {
      try {
        await api('/journal/entries', { method: 'POST', body: JSON.stringify(d) });
        sent++;
        box = box.filter(x => x.client_id !== d.client_id);
      } catch (e: any) {
        if (isNetworkError(e)) break;           // toujours hors ligne : on réessaiera
        rejected.push(d);                        // refus du serveur : on la sort de la file
        box = box.filter(x => x.client_id !== d.client_id);
      }
    }
    await writeOutbox(box);
    return { sent, remaining: box.length, rejected };
  } finally { flushing = false; }
}

/** Nombre d'entrées en attente + rejeu automatique au retour au premier plan. */
export function useOutbox() {
  const [pending, setPending] = useState(0);
  const refresh = useCallback(async () => { setPending((await readOutbox()).length); }, []);
  const flush = useCallback(async () => { const r = await flushOutbox(); await refresh(); return r; }, [refresh]);
  useEffect(() => {
    refresh();
    listeners.add(refresh);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') flush(); });
    flush();
    return () => { listeners.delete(refresh); sub.remove(); };
  }, [refresh, flush]);
  return { pending, flush, refresh };
}

/** Entrées locales en attente, présentées comme des entrées (pour les listes). */
export function outboxAsEntries(box: Draft[], books: Record<string, EntryBook> = {}): Entry[] {
  return box.map(d => ({
    entry_id: d.client_id, client_id: d.client_id, book_id: d.book_id, date: d.date, page: d.page, chapter: d.chapter,
    content: d.content, mood: d.mood, quote_ids: d.quote_ids, prompt_id: d.prompt_id, prompt_text: d.prompt_text,
    is_public: d.is_public, created_at: new Date().toISOString(), book: books[d.book_id] || { book_id: d.book_id },
    quotes: [], mood_info: moodOf(d.mood) || null, pending: true,
  }));
}

export function groupByDay(entries: Entry[]): { day: string; items: Entry[] }[] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) { const k = e.date || e.created_at.slice(0, 10); if (!map.has(k)) map.set(k, []); map.get(k)!.push(e); }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, items]) => ({ day, items }));
}

export function dayLabel(day: string, lang: 'fr' | 'en' = 'fr'): string {
  const today = localDateKey();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (day === today) return lang === 'fr' ? 'Aujourd’hui' : 'Today';
  if (day === localDateKey(y)) return lang === 'fr' ? 'Hier' : 'Yesterday';
  try {
    return new Date(`${day}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return day; }
}
