// クロスワード（JSON）から HTML 1枚を作る。ファイル操作はしない。

// locales/<locale>.js のソースを、ブラウザでそのまま動く形にする
export function inlineLocale(source) {
  return source.replace(/^export /gm, '');
}

export const DEFAULT_IMAGE = 'default.svg';

export function renderPuzzleHtml({ template, puzzle, localeSource, site }) {
  // テーマの絵は site/images/ に置く。なければ方眼紙の絵
  const data = { ...puzzle, image: `images/${puzzle.image ?? DEFAULT_IMAGE}` };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return template
    .replace('__TITLE__', `${escapeHtml(puzzle.title)}｜${escapeHtml(site.name)} ${puzzle.date}`)
    .replaceAll('__SITE_NAME__', escapeHtml(site.name))
    .replace('/*__LOCALE__*/', () => inlineLocale(localeSource))
    .replace('/*__PUZZLE__*/null', () => json);
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
