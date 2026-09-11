// Export PDF du journal d'un livre (Premium) : entrées datées, humeur, page, prompt, citations rattachées.
import { MOODS } from '@/src/journal';

const c = { espresso: '#3A2119', glacier: '#D2E2EC', bisque: '#EBCDB7', chambray: '#79A3C3', clay: '#957662', creme: '#F5EDE4' };
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (d: string) => { try { return new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };

export function buildJournalHtml(book: any, entries: any[], author?: string): string {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const moods = sorted.filter(e => e.mood);
  const avg = moods.length ? moods.reduce((s, e) => s + e.mood, 0) / moods.length : null;
  const dominant = avg ? MOODS[Math.min(4, Math.max(0, Math.round(avg) - 1))] : null;
  const items = sorted.map(e => {
    const m = MOODS.find(x => x.value === e.mood);
    return `<article class="entry">
      <div class="head"><span class="date">${esc(fmt(e.date))}</span>${e.page ? `<span class="page">p. ${esc(e.page)}</span>` : e.chapter ? `<span class="page">chap. ${esc(e.chapter)}</span>` : ''}${m ? `<span class="mood" style="background:${m.color}20;border-color:${m.color}"><i style="background:${m.color}"></i>${esc(m.label)}</span>` : ''}</div>
      ${e.prompt_text ? `<p class="prompt">${esc(e.prompt_text)}</p>` : ''}
      ${e.content ? `<p class="text">${esc(e.content).replace(/\n/g, '<br/>')}</p>` : ''}
      ${(e.quotes || []).map((q: any) => `<blockquote>« ${esc(q.text)} »${q.page ? `<span class="qpage">p. ${esc(q.page)}</span>` : ''}</blockquote>`).join('')}
    </article>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Journal — ${esc(book.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: ${c.espresso}; background: #fff; margin: 0; font-size: 12.5px; line-height: 1.6; }
  header { border-bottom: 2px solid ${c.espresso}; padding-bottom: 14px; margin-bottom: 8px; }
  .brand { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: ${c.clay}; font-weight: 500; }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 600; font-size: 32px; margin: 6px 0 2px; }
  .author { color: ${c.clay}; font-size: 14px; }
  .stats { display: flex; gap: 18px; margin-top: 10px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: ${c.clay}; font-weight: 500; }
  .stats b { color: ${c.espresso}; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 18px; letter-spacing: 0; text-transform: none; margin-right: 4px; }
  .entry { padding: 14px 0; border-bottom: 1px solid ${c.bisque}; page-break-inside: avoid; }
  .head { display: flex; align-items: center; gap: 10px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: ${c.clay}; font-weight: 500; }
  .date { text-transform: capitalize; }
  .mood { display: inline-flex; align-items: center; gap: 6px; border: 1px solid; border-radius: 99px; padding: 2px 9px; text-transform: none; letter-spacing: 0; font-size: 11px; color: ${c.espresso}; }
  .mood i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .prompt { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 16px; color: ${c.chambray}; margin: 8px 0 2px; }
  .text { font-size: 13.5px; margin: 6px 0 0; white-space: pre-wrap; }
  blockquote { margin: 10px 0 0; padding: 10px 14px; border-left: 3px solid ${c.chambray}; background: ${c.creme}; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 15px; }
  .qpage { display: block; font-family: 'Inter', sans-serif; font-style: normal; font-size: 10px; color: ${c.clay}; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 4px; }
  .empty { color: ${c.clay}; font-style: italic; padding: 24px 0; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid ${c.bisque}; color: ${c.clay}; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; display: flex; justify-content: space-between; }
</style></head>
<body>
<header>
  <div class="brand">Manent · journal de lecture${author ? ` · ${esc(author)}` : ''}</div>
  <h1>${esc(book.title)}</h1>
  ${book.author ? `<div class="author">${esc(book.author)}</div>` : ''}
  <div class="stats"><span><b>${sorted.length}</b> ${sorted.length > 1 ? 'entrées' : 'entrée'}</span>${sorted.length ? `<span><b>${esc(fmt(sorted[0].date).replace(/^\w+ /, ''))}</b> → <b>${esc(fmt(sorted[sorted.length - 1].date).replace(/^\w+ /, ''))}</b></span>` : ''}${dominant ? `<span>humeur <b>${esc(dominant.label)}</b></span>` : ''}</div>
</header>
${items || '<p class="empty">Aucune entrée pour ce livre.</p>'}
<div class="footer"><span>verba volant, scripta manent</span><span>${esc(new Date().toLocaleDateString('fr-FR'))}</span></div>
</body></html>`;
}
