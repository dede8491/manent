/**
 * Fonction edge `wattpad-import` — Wattpad n'expose pas d'API publique.
 * On récupère la page de l'histoire et on lit ses métadonnées Open Graph
 * ainsi que les données structurées de la liste des chapitres.
 *
 * La mise en page de Wattpad peut changer : la fonction renvoie toujours un
 * objet exploitable, quitte à laisser des champs vides que l'utilisateur
 * complètera dans l'app.
 */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const meta = (html: string, property: string): string | null => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  return html.match(re)?.[1] ?? null;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { url } = (await req.json()) as { url?: string };
  if (!url || !/^https?:\/\/(www\.)?wattpad\.com\//i.test(url)) {
    return json({ error: 'Lien Wattpad invalide' }, 400);
  }

  const page = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ManentBot/1.0; +https://manent.app)' },
  });
  if (!page.ok) return json({ error: 'Page inaccessible', status: page.status }, 502);

  const html = await page.text();

  const rawTitle = meta(html, 'og:title') ?? '';
  // Wattpad titre ses pages « Titre - Chapitre X » ou « Titre | Wattpad ».
  const title = decode(rawTitle.split(/\s[|-]\s/)[0].trim());

  const description = meta(html, 'og:description');
  const coverUrl = meta(html, 'og:image');
  const author =
    meta(html, 'books:author') ??
    html.match(/"username"\s*:\s*"([^"]+)"/)?.[1] ??
    null;

  const chapters = Number(
    html.match(/"numParts"\s*:\s*(\d+)/)?.[1] ??
      html.match(/(\d+)\s+(?:parts|chapitres|parties)/i)?.[1] ??
      0,
  );

  const genre = html.match(/"category"\s*:\s*"([^"]+)"/)?.[1] ?? null;

  return json({
    title: title || 'Histoire Wattpad',
    author: author ? (author.startsWith('@') ? author : `@${author}`) : '@auteur',
    coverUrl,
    chapters: Number.isFinite(chapters) ? chapters : 0,
    genre: genre ? decode(genre) : null,
    description: description ? decode(description) : null,
  });
});
