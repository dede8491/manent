// Génère le HTML imprimable (PDF) de la fiche scolaire d'un livre type "etude".
const c = {
  espresso: '#3A2119',
  glacier: '#D2E2EC',
  bisque: '#EBCDB7',
  chambray: '#79A3C3',
  clay: '#957662',
  creme: '#F5EDE4',
};

const esc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildSheetHtml(book: any, quotes: any[]): string {
  const sheet = book.sheet || {};
  const characters: { name: string; description: string }[] = sheet.characters || [];
  const themes: string[] = sheet.themes || [];
  const filled = [
    (sheet.author_bio || '').trim().length > 0,
    characters.length > 0,
    (sheet.summary || '').trim().length > 0,
    themes.length > 0,
  ].filter(Boolean).length;
  const pct = Math.round((filled / 4) * 100);
  const total = book.pages || 0;
  const prog = book.progress_page || 0;
  const progPct = total && prog ? Math.min(100, Math.round((prog / total) * 100)) : 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Fiche — ${esc(book.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>
  @page { margin: 24mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: ${c.espresso}; background: #fff; margin: 0; font-size: 13px; line-height: 1.55; }
  .serif { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
  .brand { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: ${c.clay}; font-weight: 500; }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 600; font-size: 34px; margin: 6px 0 2px; }
  .author { color: ${c.clay}; font-size: 15px; margin-bottom: 4px; }
  .meta { color: ${c.clay}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; }
  .bar { height: 5px; background: ${c.glacier}; border-radius: 3px; margin: 8px 0 4px; overflow: hidden; }
  .bar > div { height: 5px; background: ${c.chambray}; }
  .section { margin-top: 26px; page-break-inside: avoid; }
  .label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${c.clay}; font-weight: 500; border-bottom: 1px solid ${c.bisque}; padding-bottom: 6px; margin-bottom: 10px; }
  .card { background: ${c.creme}; border: 1px solid ${c.bisque}; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
  .charname { font-weight: 500; }
  .chardesc { color: ${c.clay}; font-size: 12px; margin-top: 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { background: ${c.chambray}; color: ${c.creme}; border-radius: 99px; padding: 4px 12px; font-size: 12px; font-weight: 500; }
  .quote { background: ${c.bisque}; border-radius: 8px; padding: 16px 18px; margin-bottom: 10px; page-break-inside: avoid; }
  .qmark { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; color: ${c.chambray}; font-size: 34px; line-height: 12px; display: block; margin-bottom: 8px; }
  .qtext { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 17px; line-height: 1.45; }
  .qpage { color: ${c.clay}; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 8px; font-weight: 500; }
  .empty { color: ${c.clay}; font-style: italic; }
  .footer { margin-top: 34px; padding-top: 12px; border-top: 1px solid ${c.bisque}; color: ${c.clay}; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; }
  header { border-bottom: 2px solid ${c.espresso}; padding-bottom: 16px; }
</style>
</head>
<body>
  <header>
    <div class="brand">Manent · Fiche d'études · ${pct}% complétée</div>
    <h1>${esc(book.title)}</h1>
    ${book.author ? `<div class="author serif">${esc(book.author)}</div>` : ''}
    ${total ? `<div class="meta">Lecture : ${prog} / ${total} pages · ${progPct}%</div><div class="bar"><div style="width:${progPct}%"></div></div>` : ''}
  </header>

  <div class="section">
    <div class="label">L'auteur</div>
    ${sheet.author_bio ? `<p>${esc(sheet.author_bio)}</p>` : '<p class="empty">Section à compléter.</p>'}
  </div>

  <div class="section">
    <div class="label">Personnages</div>
    ${characters.length ? characters.map(ch => `<div class="card"><div class="charname">${esc(ch.name)}</div>${ch.description ? `<div class="chardesc">${esc(ch.description)}</div>` : ''}</div>`).join('') : '<p class="empty">Section à compléter.</p>'}
  </div>

  <div class="section">
    <div class="label">Résumé</div>
    ${sheet.summary ? `<p>${esc(sheet.summary)}</p>` : '<p class="empty">Section à compléter.</p>'}
  </div>

  <div class="section">
    <div class="label">Thèmes de l'œuvre</div>
    ${themes.length ? `<div class="chips">${themes.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : '<p class="empty">Section à compléter.</p>'}
  </div>

  ${quotes.length ? `<div class="section">
    <div class="label">Citations relevées (${quotes.length})</div>
    ${quotes.map(q => `<div class="quote"><span class="qmark">&ldquo;</span><div class="qtext">${esc(q.text)}</div>${q.page ? `<div class="qpage">Page ${q.page}</div>` : ''}</div>`).join('')}
  </div>` : ''}

  <div class="footer">Manent — verba volant, scripta manent</div>
</body>
</html>`;
}
