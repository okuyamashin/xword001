// クロスワード（JSON）から HTML を作る。ファイル操作はしない。

export const DEFAULT_IMAGE = 'default.svg';

// locales/<locale>.js のソースを、ブラウザでそのまま動く形にする
export function inlineLocale(source) {
  return source.replace(/^export /gm, '');
}

// パズルのページのファイル名
export function pageName(puzzle) {
  return `${puzzle.id}.html`;
}

export function puzzleHeading(puzzle) {
  return `${puzzle.title}のクロスワードパズル`;
}

export function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

// どのページにも共通の部品（CSS・ヘッダー・フッター・サイト名）をはめこむ
function fillCommon(html, { parts, site, current }) {
  let header = parts.header;
  if (current) header = header.replace(`href="${current}"`, `href="${current}" aria-current="page"`);
  return html
    .replace('/*__BASE_CSS__*/', () => parts.baseCss)
    .replace('<!--__HEADER__-->', () => header)
    .replace('<!--__FOOTER__-->', () => parts.footer)
    .replaceAll('__SITE_NAME__', escapeHtml(site.name));
}

// image: site/images/ の中のファイル名（ジャンルの絵。なければ方眼紙。呼び出し側で決める）
// related: 同じテーマのほかの回（このパズルを除く）
export function renderPuzzleHtml({ template, parts, puzzle, localeSource, site, image, related = [], isLatest = false }) {
  const description = puzzle.description ?? '';
  const data = { ...puzzle, description, image: `images/${image ?? puzzle.image ?? DEFAULT_IMAGE}` };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const relatedHtml = related.length
    ? `  <section class="related">\n    <h2>${escapeHtml(puzzle.title)}のほかの回</h2>\n    <ul>${related
        .map((p) => `<li><a href="${pageName(p)}">第${p.round ?? 1}回（${formatDate(p.date)}）</a></li>`)
        .join('')}</ul>\n  </section>\n`
    : '';
  const html = template
    .replace('__TITLE__', `${escapeHtml(puzzleHeading(puzzle))} 第${puzzle.round ?? 1}回｜${escapeHtml(site.name)}`)
    .replace('__DESCRIPTION__', escapeHtml(description))
    .replace('<!--__RELATED__-->', () => relatedHtml)
    .replace('/*__LOCALE__*/', () => inlineLocale(localeSource))
    .replace('/*__PUZZLE__*/null', () => json);
  return fillCommon(html, { parts, site, current: isLatest ? 'index.html' : null });
}

// 一覧ページ。entries: [{ puzzle, image }]
export function renderArchiveHtml({ template, parts, site, entries, latestCount = 4 }) {
  const byDate = [...entries].sort((a, b) => b.puzzle.serial - a.puzzle.serial);
  const card = ({ puzzle, image }) => {
    const description = puzzle.description ?? '';
    return `    <li><a class="card" href="${pageName(puzzle)}" data-id="${escapeHtml(puzzle.id)}">
      <img src="images/${escapeHtml(image)}" alt="" loading="lazy" width="88" height="88">
      <div class="meta">
        <p class="date">No.${String(puzzle.serial).padStart(5, '0')}　${formatDate(puzzle.date)}</p>
        <p class="title">${escapeHtml(puzzleHeading(puzzle))}<span class="round">第${puzzle.round ?? 1}回</span><span class="status"></span></p>
        <p class="desc">${escapeHtml(description)}</p>
      </div>
    </a></li>`;
  };
  const list = (items) => `  <ul class="cards">\n${items.map(card).join('\n')}\n  </ul>`;

  // テーマごと。最近出たテーマを先に、各テーマの中は新しい回から
  const groups = new Map();
  for (const e of byDate) {
    if (!groups.has(e.puzzle.theme)) groups.set(e.puzzle.theme, []);
    groups.get(e.puzzle.theme).push(e);
  }
  const themes = [...groups.values()]
    .map((items) => {
      const p = items[0].puzzle;
      const en = p.subtitle ? `<span class="en">${escapeHtml(p.subtitle)}</span>` : '';
      return `  <h2 class="section" id="theme-${escapeHtml(p.theme)}">${escapeHtml(p.title)}${en}</h2>\n${list(items)}`;
    })
    .join('\n');

  const html = template
    .replace('<!--__LATEST__-->', () => list(byDate.slice(0, latestCount)))
    .replace('<!--__THEMES__-->', () => themes);
  return fillCommon(html, { parts, site, current: 'archive.html' });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
