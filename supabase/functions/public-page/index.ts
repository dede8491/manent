/**
 * Fonction edge `public-page` — les pages web publiques de Manent, lisibles
 * sans compte : c'est la porte d'entrée virale et le SEO de l'app.
 *
 *   manent.app/q/:id       une citation publique
 *   manent.app/b/:slug     un tableau public ou collaboratif
 *   manent.app/@pseudo     un profil public
 *
 * Elle n'expose que ce qui est explicitement public : jamais une citation
 * privée, jamais une photo de page (droit de courte citation).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://manent.app';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Les pages publiques sont mises en cache par le CDN : elles bougent peu.
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });

function page(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)} · Manent</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(opts.canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Manent">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${esc(opts.canonical)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Public+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --paper:#F5F4EF; --card:#FFF; --ink:#1F2430; --ink-soft:#5A6072;
    --rule:#E3E1D8; --green:#275C4B; --green-pale:#E4EDE7; --amber:#C9973B;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font-family:'Public Sans',system-ui,sans-serif; line-height:1.55; }
  .wrap { max-width:640px; margin:0 auto; padding:32px 20px 64px; }
  header a { display:inline-flex; align-items:center; gap:8px; text-decoration:none;
             color:var(--green); font-weight:700; }
  .mark { font-family:Fraunces,Georgia,serif; font-size:26px; color:var(--amber); }
  .sheet { background:var(--card); border:1px solid var(--rule); border-radius:14px;
           border-left:4px solid var(--green); padding:24px; margin:24px 0;
           display:flex; gap:16px; }
  .sheet blockquote { font-family:Fraunces,Georgia,serif; font-size:20px; line-height:1.5;
                      margin:0 0 12px; }
  .source { color:var(--ink-soft); font-size:13px; margin:0; }
  .locator { text-align:center; min-width:64px; }
  .locator span { display:block; font-size:10px; letter-spacing:1.4px; font-weight:700;
                  color:var(--amber); }
  .locator strong { font-family:Fraunces,Georgia,serif; font-size:30px; color:var(--amber); }
  .themes a { display:inline-block; margin:0 8px 8px 0; padding:5px 12px; border-radius:999px;
              background:var(--green-pale); color:var(--green); text-decoration:none;
              font-size:13px; font-weight:500; }
  h1 { font-family:Fraunces,Georgia,serif; font-size:28px; margin:0 0 4px; }
  .lede { color:var(--ink-soft); margin-top:0; }
  .cta { display:block; margin-top:32px; padding:16px; border-radius:14px;
         background:var(--green); color:#fff; text-align:center; text-decoration:none;
         font-weight:700; }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--rule);
           color:var(--ink-soft); font-size:12px; }
</style>
</head>
<body>
  <div class="wrap">
    <header><a href="${SITE}"><span class="mark">❧</span> Manent</a></header>
    ${opts.body}
    <a class="cta" href="${SITE}/app">Capturer mes lectures avec Manent</a>
    <footer>Manent — ce que tes lectures laissent derrière elles.
      Citations reproduites avec mention de l'auteur et de l'œuvre.</footer>
  </div>
</body>
</html>`;
}

const notFound = () =>
  html(
    page({
      title: 'Page introuvable',
      description: "Cette page n'existe pas ou n'est plus publique.",
      canonical: SITE,
      body: '<h1>Page introuvable</h1><p class="lede">Ce contenu n’existe pas, ou n’est plus public.</p>',
    }),
    404,
  );

function quoteSheet(q: {
  text: string;
  locator: number | null;
  title: string;
  author: string;
  isChapter: boolean;
}): string {
  return `<div class="sheet">
    <div style="flex:1">
      <blockquote>« ${esc(q.text)} »</blockquote>
      <p class="source">${esc(q.title)} · ${esc(q.author)}</p>
    </div>
    ${
      q.locator != null
        ? `<div class="locator"><span>${q.isChapter ? 'CHAP.' : 'PAGE'}</span><strong>${q.locator}</strong></div>`
        : ''
    }
  </div>`;
}

Deno.serve(async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/^\/public-page/, '') || '/';

  // ── Citation : /q/:id ──
  const quoteMatch = path.match(/^\/q\/([\w-]+)\/?$/);
  if (quoteMatch) {
    const { data } = await supabase
      .from('quotes')
      .select('text, locator, is_public, themes, books(title, author, kind), profiles(pseudo)')
      .eq('id', quoteMatch[1])
      .eq('is_public', true)
      .maybeSingle();
    if (!data) return notFound();

    const book = (data.books ?? {}) as { title?: string; author?: string; kind?: string };
    const profile = (data.profiles ?? {}) as { pseudo?: string };
    const themes = (data.themes ?? []) as string[];

    return html(
      page({
        title: `« ${data.text.slice(0, 60)}… »`,
        description: `${data.text.slice(0, 150)} — ${book.title ?? ''}, ${book.author ?? ''}`,
        canonical: `${SITE}/q/${quoteMatch[1]}`,
        body: `
          ${quoteSheet({
            text: data.text,
            locator: data.locator,
            title: book.title ?? 'Lecture',
            author: book.author ?? '',
            isChapter: book.kind === 'wattpad',
          })}
          <p class="lede">Capturée par <a href="${SITE}/@${esc(profile.pseudo ?? '')}">${esc(profile.pseudo ?? '')}</a></p>
          <div class="themes">${themes
            .map((t) => `<a href="${SITE}/t/${encodeURIComponent(t)}">#${esc(t)}</a>`)
            .join('')}</div>`,
      }),
    );
  }

  // ── Tableau : /b/:slug ──
  const boardMatch = path.match(/^\/b\/([\w-]+)\/?$/);
  if (boardMatch) {
    const { data: board } = await supabase
      .from('boards')
      .select('id, name, description, visibility, profiles(pseudo)')
      .eq('share_slug', boardMatch[1])
      .neq('visibility', 'prive')
      .maybeSingle();
    if (!board) return notFound();

    const { data: pins } = await supabase
      .from('board_quotes')
      .select('quotes(text, locator, is_public, books(title, author, kind))')
      .eq('board_id', board.id)
      .order('pinned_at', { ascending: false })
      .limit(40);

    const sheets = (pins ?? [])
      .map((p) => p.quotes as unknown as {
        text: string;
        locator: number | null;
        is_public: boolean;
        books: { title?: string; author?: string; kind?: string } | null;
      })
      // Une citation privée épinglée sur un tableau public reste privée.
      .filter((q) => q?.is_public)
      .map((q) =>
        quoteSheet({
          text: q.text,
          locator: q.locator,
          title: q.books?.title ?? 'Lecture',
          author: q.books?.author ?? '',
          isChapter: q.books?.kind === 'wattpad',
        }),
      )
      .join('');

    const owner = (board.profiles ?? {}) as { pseudo?: string };
    return html(
      page({
        title: board.name,
        description: board.description || `Un tableau de citations par ${owner.pseudo ?? ''}.`,
        canonical: `${SITE}/b/${boardMatch[1]}`,
        body: `<h1>${esc(board.name)}</h1>
               <p class="lede">${esc(board.description)} — par ${esc(owner.pseudo ?? '')}</p>
               ${sheets || '<p class="lede">Ce tableau ne contient pas encore de citation publique.</p>'}`,
      }),
    );
  }

  // ── Profil : /@pseudo ──
  const profileMatch = path.match(/^\/@([\w.-]+)\/?$/);
  if (profileMatch) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, pseudo, bio')
      .eq('pseudo', profileMatch[1])
      .maybeSingle();
    if (!profile) return notFound();

    const { data: quotes } = await supabase
      .from('quotes')
      .select('text, locator, books(title, author, kind)')
      .eq('user_id', profile.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20);

    const sheets = (quotes ?? [])
      .map((q) => {
        const book = (q.books ?? {}) as { title?: string; author?: string; kind?: string };
        return quoteSheet({
          text: q.text,
          locator: q.locator,
          title: book.title ?? 'Lecture',
          author: book.author ?? '',
          isChapter: book.kind === 'wattpad',
        });
      })
      .join('');

    return html(
      page({
        title: `@${profile.pseudo}`,
        description: profile.bio || `Les citations de ${profile.pseudo} sur Manent.`,
        canonical: `${SITE}/@${profile.pseudo}`,
        body: `<h1>@${esc(profile.pseudo)}</h1>
               <p class="lede">${esc(profile.bio)}</p>
               ${sheets || '<p class="lede">Aucune citation publique pour l’instant.</p>'}`,
      }),
    );
  }

  return notFound();
});
