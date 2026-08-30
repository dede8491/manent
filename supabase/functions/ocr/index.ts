/**
 * Fonction edge `ocr` — transcription par IA des photos de pages.
 *
 * Une seule brique, deux consignes :
 *  - task « citation » : rendre le texte de la page, sans commentaire ;
 *  - task « page »     : ne renvoyer que le numéro de page imprimé.
 *
 * La clé de l'API vision ne quitte jamais le serveur. Le quota du plan
 * gratuit (15 transcriptions/mois) est vérifié ici, pas dans l'application.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FREE_MONTHLY_CAPTURES = 15;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

const PROMPTS: Record<string, string> = {
  citation: [
    "Tu transcris la photo d'une page de livre pour un lecteur qui archive ses citations.",
    'Rends UNIQUEMENT le texte lisible sur la page, à la lettre, sans commentaire, sans guillemets ajoutés.',
    "Si un passage est surligné ou souligné, ne rends que ce passage.",
    "Si un numéro de page est visible, indique-le dans le champ detectedPage.",
    'Réponds en JSON strict : {"text": string, "detectedPage": number|null, "confidence": number}',
  ].join(' '),
  page: [
    "Tu lis le numéro de page imprimé sur la photo d'une page de livre.",
    'Ne rends que ce nombre, rien d’autre. Ignore les numéros de chapitre et les notes de bas de page.',
    'Réponds en JSON strict : {"text": string, "detectedPage": number|null, "confidence": number}',
  ].join(' '),
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authentification requise' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Session invalide' }, 401);
  const userId = auth.user.id;

  const { image, task } = (await req.json()) as { image?: string; task?: string };
  if (!image) return json({ error: 'Image manquante' }, 400);
  const prompt = PROMPTS[task ?? 'citation'] ?? PROMPTS.citation;

  // Quota mensuel : illimité en Premium.
  const month = new Date().toISOString().slice(0, 7);
  const { data: profile } = await supabase
    .from('profiles')
    .select('premium')
    .eq('id', userId)
    .single();

  if (!profile?.premium) {
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();

    if ((usage?.count ?? 0) >= FREE_MONTHLY_CAPTURES) {
      return json(
        {
          error: 'quota_atteint',
          message: `Le plan gratuit inclut ${FREE_MONTHLY_CAPTURES} transcriptions par mois.`,
        },
        429,
      );
    }
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Service de transcription non configuré' }, 503);

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return json({ error: 'transcription_echouee', status: response.status }, 502);
  }

  const payload = await response.json();
  const raw: string = payload?.content?.[0]?.text ?? '';

  let result = { text: raw.trim(), detectedPage: null as number | null, confidence: 0.5 };
  try {
    // Le modèle renvoie du JSON ; on tolère qu'il l'entoure de texte.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      result = {
        text: String(parsed.text ?? '').trim(),
        detectedPage:
          parsed.detectedPage == null || Number.isNaN(Number(parsed.detectedPage))
            ? null
            : Number(parsed.detectedPage),
        confidence: Number(parsed.confidence ?? 0.8),
      };
    }
  } catch {
    // On garde le texte brut : mieux vaut une transcription imparfaite qu'une erreur.
  }

  if (!profile?.premium) {
    await supabase.rpc('increment_ai_usage', { p_user_id: userId, p_month: month });
  }

  return json(result);
});
