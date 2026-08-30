import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { formatDay } from '@/lib/format';
import type { Book, Quote } from '@/types';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Export PDF de la fiche (fonctionnalité Premium). Pour une lecture scolaire
 * c'est littéralement le devoir à rendre : on reprend la mise en page de la
 * fiche structurée.
 */
export async function exportBookSheetPdf(book: Book, quotes: Quote[]): Promise<void> {
  const isStudy = book.kind === 'etude';
  const unit = book.kind === 'wattpad' ? 'Chap.' : 'p.';

  const sections = isStudy
    ? book.studySheet
        .map(
          (s) => `
        <section>
          <h2>${escape(s.label)}</h2>
          <p>${escape(s.content) || '<em>à compléter</em>'}</p>
        </section>`,
        )
        .join('')
    : `
      <section>
        <h2>Mon récapitulatif</h2>
        <p>${escape(book.summary) || '<em>—</em>'}</p>
      </section>
      <section>
        <h2>Enseignements tirés</h2>
        <ul>${book.lessons.map((l) => `<li>${escape(l)}</li>`).join('') || '<li><em>—</em></li>'}</ul>
      </section>`;

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1F2430; line-height: 1.55; }
  header { border-bottom: 3px solid #275C4B; padding-bottom: 10px; margin-bottom: 22px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .author { color: #5A6072; font-size: 14px; margin: 0; }
  .meta { color: #5A6072; font-size: 12px; margin-top: 8px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.2px;
       color: #275C4B; margin: 24px 0 6px; font-family: Helvetica, Arial, sans-serif; }
  blockquote { border-left: 3px solid #275C4B; margin: 12px 0; padding: 2px 0 2px 14px; }
  blockquote p { margin: 0 0 4px; }
  .page { color: #C9973B; font-weight: bold; font-size: 12px;
          font-family: Helvetica, Arial, sans-serif; }
  footer { margin-top: 34px; border-top: 1px solid #E3E1D8; padding-top: 8px;
           color: #5A6072; font-size: 10px; font-family: Helvetica, Arial, sans-serif; }
</style></head>
<body>
  <header>
    <h1>${escape(book.title)}</h1>
    <p class="author">${escape(book.author)}</p>
    <p class="meta">${
      isStudy
        ? `${escape(book.schoolLevel ?? 'Fiche de lecture')}${
            book.examDate ? ` · examen le ${formatDay(book.examDate)}` : ''
          }`
        : `Fiche de lecture · ${quotes.length} citation${quotes.length > 1 ? 's' : ''}`
    }</p>
  </header>
  ${sections}
  <section>
    <h2>Citations</h2>
    ${
      quotes
        .map(
          (q) => `<blockquote>
            <p>« ${escape(q.text)} »</p>
            ${q.locator != null ? `<span class="page">${unit} ${q.locator}</span>` : ''}
            ${q.note ? `<p><em>${escape(q.note)}</em></p>` : ''}
          </blockquote>`,
        )
        .join('') || '<p><em>Aucune citation capturée.</em></p>'
    }
  </section>
  <footer>Fiche exportée depuis Manent — manent.app</footer>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
}
