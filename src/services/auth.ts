import { supabase } from './supabase';

/**
 * Authentification Supabase. Sans backend configuré, l'app reste utilisable en
 * local : chaque fonction renvoie alors une erreur explicite plutôt que de
 * planter, et l'appelant retombe sur le compte local.
 */
export interface AuthResult {
  userId: string | null;
  /** Message prêt à afficher, en français, quand quelque chose a échoué. */
  error: string | null;
}

const NO_BACKEND = "Aucun backend n'est configuré sur cette installation.";

/** Traduit les erreurs Supabase les plus courantes. */
function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('already registered')) return 'Un compte existe déjà avec cet e-mail.';
  if (m.includes('email not confirmed')) return "Confirme ton e-mail avant de te connecter.";
  if (m.includes('network')) return 'Connexion impossible. Vérifie ton réseau.';
  return message;
}

export async function signUp(
  email: string,
  password: string,
  pseudo: string,
): Promise<AuthResult> {
  const client = supabase();
  if (!client) return { userId: null, error: NO_BACKEND };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    // Le trigger `handle_new_user` reprend ce pseudo pour créer le profil.
    options: { data: { pseudo } },
  });
  return { userId: data.user?.id ?? null, error: error ? humanize(error.message) : null };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = supabase();
  if (!client) return { userId: null, error: NO_BACKEND };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { userId: data.user?.id ?? null, error: error ? humanize(error.message) : null };
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Connexion Google ou Apple. Supabase renvoie l'URL du fournisseur : l'app
 * l'ouvre dans un onglet système, qui redirige vers le schéma `manent://`.
 */
export async function oauthUrl(provider: 'google' | 'apple'): Promise<string | null> {
  const client = supabase();
  if (!client) return null;

  const { data } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: 'manent://auth/callback', skipBrowserRedirect: true },
  });
  return data?.url ?? null;
}
