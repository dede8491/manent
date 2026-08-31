// Génère le HTML imprimable (PDF) d'une fiche de lecture (carnet).
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

const nl = (s: string) => esc(s).replace(/\n/g, '<br/>');

export type FicheData = {
  genre?: string; publisher?: string; author_bio?: string; summary?: string;
  ideas?: string[]; passages?: { text: string; note?: string }[];
  takeaways?: string[]; questions?: string[]; review?: string; recommend?: string;
};

export function buildFicheHtml(book: any, fiche: FicheData, rating: number, labels: Record<string, string>): string {
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const section = (label: string, inner: string) =>
    inner.trim()
      ? `<div class="section"><div class="label">${esc(label)}</div>${inner}</div>`
      : '';
  const list = (items?: string[]) =>
    (items || []).filter(Boolean).length
      ? `<ul>${(items || []).filter(Boolean).map(i => `<li>${nl(i)}</li>`).join('')}</ul>`
      : '';
  const meta = [
    book.author, fiche.publisher, book.year,
    book.pages ? `${book.pages} p.` : null, fiche.genre,
  ].filter(Boolean).map(esc).join('  ·  ');
  const passages = (fiche.passages || []).filter(p => (p.text || '').trim()).map(p => `
    <div class="quote">
      <div class="qtext">« ${nl(p.text)} »</div>
      ${p.note ? `<div class="qnote">${nl(p.note)}</div>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { margin: 48px; }
  body { font-family: Georgia, 'Times New Roman', serif; color: ${c.espresso}; background: ${c.creme}; margin: 0; padding: 40px; }
  .head { border-bottom: 2px solid ${c.espresso}; padding-bottom: 20px; margin-bottom: 8px; }
  .brand { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: ${c.clay}; }
  h1 { font-style: italic; font-weight: 500; font-size: 34px; margin: 8px 0 4px; }
  .meta { font-size: 12px; color: ${c.clay}; letter-spacing: 0.5px; }
  .stars { font-size: 16px; color: ${c.chambray}; margin-top: 6px; letter-spacing: 3px; }
  .section { margin-top: 26px; page-break-inside: avoid; }
  .label { font-size: 10.5px; letter-spacing: 2.5px; text-transform: uppercase; color: ${c.chambray}; border-bottom: 1px solid ${c.bisque}; padding-bottom: 5px; margin-bottom: 10px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; }
  p, li { font-size: 13.5px; line-height: 1.65; margin: 0 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  .quote { border-left: 3px solid ${c.bisque}; padding: 8px 0 8px 14px; margin-bottom: 12px; }
  .qtext { font-style: italic; font-size: 14px; line-height: 1.6; }
  .qnote { font-size: 12px; color: ${c.clay}; margin-top: 5px; font-family: Helvetica, Arial, sans-serif; }
  .footer { margin-top: 44px; text-align: center; font-size: 10px; color: ${c.clay}; letter-spacing: 2px; font-style: italic; }
</style></head><body>
  <div class="head">
    <div class="brand">Manent · ${esc(labels.carnet)}</div>
    <h1>${esc(book.title)}</h1>
    <div class="meta">${meta}</div>
    ${rating > 0 ? `<div class="stars">${stars}</div>` : ''}
  </div>
  ${section(labels.author, fiche.author_bio ? `<p>${nl(fiche.author_bio)}</p>` : '')}
  ${section(labels.summary, fiche.summary ? `<p>${nl(fiche.summary)}</p>` : '')}
  ${section(labels.ideas, list(fiche.ideas))}
  ${section(labels.passages, passages)}
  ${section(labels.takeaways, list(fiche.takeaways))}
  ${section(labels.questions, list(fiche.questions))}
  ${section(labels.review, fiche.review ? `<p>${nl(fiche.review)}</p>` : '')}
  ${section(labels.recommend, fiche.recommend ? `<p>${nl(fiche.recommend)}</p>` : '')}
  <div class="footer">Manent — verba volant, scripta manent</div>
</body></html>`;
}
