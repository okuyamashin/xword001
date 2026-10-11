// クロスワード（JSON）から HTML 1枚を作る。ファイル操作はしない。

// locales/<locale>.js のソースを、ブラウザでそのまま動く形にする
export function inlineLocale(source) {
  return source.replace(/^export /gm, '');
}

export const DEFAULT_IMAGE = 'default.svg';

// image: site/images/ の中のファイル名（パズル専用の絵 → テーマの絵 → 方眼紙 の順に、呼び出し側で決める）
export function renderPuzzleHtml({ template, puzzle, localeSource, site, image }) {
  const description = puzzle.intro?.description ?? puzzle.description ?? '';
  const data = { ...puzzle, description, image: `images/${image ?? puzzle.image ?? DEFAULT_IMAGE}` };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return template
    .replace('__TITLE__', `${escapeHtml(puzzle.title)}のクロスワードパズル 第${puzzle.round ?? 1}回｜${escapeHtml(site.name)}`)
    .replace('__DESCRIPTION__', escapeHtml(description))
    .replaceAll('__SITE_NAME__', escapeHtml(site.name))
    .replace('/*__LOCALE__*/', () => inlineLocale(localeSource))
    .replace('/*__PUZZLE__*/null', () => json);
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
