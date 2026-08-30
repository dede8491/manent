/**
 * Fonction edge `flashcards` — génère des cartes question/réponse à partir de
 * la fiche de lecture de l'élève et des citations qu'il a lui-même capturées.
 *
 * C'est la même brique de modèle que `ocr`, avec une troisième consigne. Rien
 * n'est inventé hors du matériau fourni : les cartes doivent interroger ce que
 * l'élève a écrit, pas un résumé générique de l'œuvre.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';
const MAX_CARDS = 12;
const FREE_CARDS_PER_BOOK = 3;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const PROMPT = [
  "Tu prépares des cartes de révision pour un élève francophone qui passe un oral de français.",
  "On te donne sa fiche de lecture et les citations qu'il a relevées lui-même.",
  'Rédige des questions qui portent UNIQUEMENT sur ce matériau : ne fais appel à aucune',
  "connaissance extérieure, et n'invente ni personnage, ni citation, ni date.",
  'Chaque réponse tient en deux phrases au plus, en français, et réutilise les mots de l’élève',
  'quand ils sont justes.',
  `Produis au maximum ${MAX_CARDS} cartes, de la plus fondamentale à la plus fine.`,
  'Réponds en JSON strict : {"cards": [{"question": string, "answer": string}]}',
].join(' ');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authentification requise' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: auth, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !auth.user) return json({ error: 'Session invalide' }, 401);

  const { bookId } = (await req.json()) as { bookId?: string };
  if (!bookId) return json({ error: 'Livre manquant' }, 400);

  const { data: book } = await supabase
    .from('books')
    .select('title, author, school_level, study_sheet')
    .eq('id', bookId)
    .eq('user_id', auth.user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!book) return json({ error: 'Livre introuvable' }, 404);

  const { data: quotes } = await supabase
    .from('quotes')
    .select('text, locator, note')
    .eq('book_id', bookId)
    .eq('user_id', auth.user.id)
    .is('deleted_at', null)
    .limit(30);

  const sections = (book.study_sheet ?? []) as { label: string; content: string }[];
  const material = [
    `Œuvre : ${book.title} — ${book.author}${book.school_level ? ` (${book.school_level})` : ''}`,
    '',
    'FICHE DE LECTURE',
    ...sections
      .filter((s) => s.content?.trim())
      .map((s) => `${s.label} : ${s.content.trim()}`),
    '',
    'CITATIONS RELEVÉES',
    ...(quotes ?? []).map(
      (q) => `« ${q.text} »${q.locator ? ` (p. ${q.locator})` : ''}${q.note ? ` — note : ${q.note}` : ''}`,
    ),
  ].join('\n');

  // Sans matière, mieux vaut le dire que produire des cartes creuses.
  if (sections.every((s) => !s.content?.trim()) && (quotes ?? []).length === 0) {
    return json(
      {
        error: 'fiche_vide',
        message:
          'Complète au moins une rubrique de ta fiche ou capture une citation : les cartes se génèrent à partir de ton propre travail.',
      },
      422,
    );
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Service de génération non configuré' }, 503);

  const { data: profile } = await supabase
    .from('profiles')
    .select('premium')
    .eq('id', auth.user.id)
    .single();

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: `${PROMPT}\n\n${material}` }],
    }),
  });

  if (!response.ok) return json({ error: 'generation_echouee', status: response.status }, 502);

  const payload = await response.json();
  const raw: string = payload?.content?.[0]?.text ?? '';

  let cards: { question: string; answer: string }[] = [];
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { cards?: { question?: string; answer?: string }[] };
      cards = (parsed.cards ?? [])
        .filter((c) => c.question?.trim() && c.answer?.trim())
        .map((c) => ({ question: c.question!.trim(), answer: c.answer!.trim() }))
        .slice(0, MAX_CARDS);
    }
  } catch {
    return json({ error: 'reponse_illisible' }, 502);
  }

  if (cards.length === 0) return json({ error: 'aucune_carte' }, 502);

  // Le plafond du plan gratuit est appliqué ici, pas dans l'app.
  const limited = profile?.premium ? cards : cards.slice(0, FREE_CARDS_PER_BOOK);
  return json({ cards: limited, truncated: limited.length < cards.length });
});
