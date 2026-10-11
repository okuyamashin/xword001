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

export function wordsPageName(theme) {
  return `words-${theme}.html`;
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
// recent: トップページに出す、ほかの最近のクロスワード（トップページのときだけ渡す）
export function renderPuzzleHtml({ template, parts, puzzle, localeSource, site, image, related = [], recent = [], isLatest = false }) {
  const description = puzzle.description ?? '';
  const data = { ...puzzle, description, image: `images/${image ?? puzzle.image ?? DEFAULT_IMAGE}` };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const genre = puzzle.theme.split('+')[0];
  const others = related.length
    ? `\n    <h2>${escapeHtml(puzzle.title)}のほかの回</h2>\n    <ul>${related
        .map((p) => `<li><a href="${pageName(p)}">第${p.round ?? 1}回（${formatDate(p.date)}）</a></li>`)
        .join('')}</ul>`
    : '';
  const relatedHtml = `  <section class="related">${others}
    <h2>単語帳</h2>
    <ul><li><a href="${wordsPageName(genre)}">${escapeHtml(puzzle.title)}の単語帳</a>（このジャンルの言葉とカギ・解説の一覧）</li></ul>
  </section>\n`;
  const html = template
    .replace('__TITLE__', `${escapeHtml(puzzleHeading(puzzle))} 第${puzzle.round ?? 1}回｜${escapeHtml(site.name)}`)
    .replace('__DESCRIPTION__', escapeHtml(description))
    .replace('<!--__RECENT__-->', () => recentHtml(recent))
    .replace('<!--__RELATED__-->', () => relatedHtml)
    .replace('/*__LOCALE__*/', () => inlineLocale(localeSource))
    .replace('/*__PUZZLE__*/null', () => json);
  return fillCommon(html, { parts, site, current: isLatest ? 'index.html' : null });
}

function recentHtml(recent) {
  if (!recent.length) return '';
  const items = recent
    .map(
      (p) =>
        `      <li><a href="${pageName(p)}"><span class="date">${formatDate(p.date)}</span><span class="title">${escapeHtml(puzzleHeading(p))}</span><span class="round">第${p.round ?? 1}回</span></a></li>`,
    )
    .join('\n');
  return `  <section class="recent">
    <h2>最近のクロスワード</h2>
    <ul>
${items}
    </ul>
    <p class="more"><a href="archive.html">バックナンバーをすべて見る →</a></p>
  </section>`;
}

// 一覧ページ。entries: [{ puzzle, image }]
// themeFiles: テーマ ID → テーマファイル（ジャンルの説明と単語帳へのリンクに使う）
export function renderArchiveHtml({ template, parts, site, entries, themeFiles = new Map(), latestCount = 4 }) {
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
      const genre = p.theme.split('+')[0];
      const description = themeFiles.get(genre)?.description ?? p.description ?? '';
      const book = `<a href="${wordsPageName(genre)}">${escapeHtml(p.title)}の単語帳を見る →</a>`;
      return `  <h2 class="section" id="theme-${escapeHtml(p.theme)}">${escapeHtml(p.title)}${en}</h2>
  <p class="genre">${escapeHtml(description)}<br>${book}</p>
${list(items)}`;
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

const LEVELS = { 1: 'やさしい', 2: 'ふつう', 3: 'むずかしい' };

// ジャンルの単語帳（言葉・読み・難しさ・カギ・解説）。theme: テーマファイル。puzzles: このジャンルのパズル。image: 一覧用の小さい絵。jsonName: ダウンロード用の JSON
// lang: 言語設定と文字種を合わせたもの（scripts/index.js の langFor）。見出しは文字種ごと（五十音の行・頭文字）
export function renderWordsHtml({ template, parts, site, theme, puzzles, image, jsonName, lang }) {
  const words = [...theme.words].sort((a, b) => a.answer.localeCompare(b.answer, 'ja') || a.display.localeCompare(b.display, 'ja'));
  const groups = lang.groups.map((g) => [g, words.filter((w) => lang.groupOf(w.answer) === g)]).filter(([, ws]) => ws.length);
  const entry = (w) => {
    // 表記とマスの文字がちがう語（漢字の語、C# など）には、マスに入る文字を添える
    const reading = lang.normalize(w.display) === w.answer ? '' : `<span class="reading">${escapeHtml(w.answer)}</span>`;
    const level = w.level ? `<span class="level">${LEVELS[w.level]}</span>` : '';
    const row = (label, text) => (text ? `\n        <p class="row"><span class="lbl">${label}</span><span class="text">${escapeHtml(text)}</span></p>` : '');
    return `      <li class="entry"><p class="word">${escapeHtml(w.display)}${reading}${level}</p>${row('カギ', w.clue)}${row('解説', w.explanation)}</li>`;
  };
  const entries = groups
    .map(([g, ws]) => `  <section class="group">\n    <h2 class="gyou" id="gyou-${g}">${lang.groupTitle(g)}</h2>\n    <ul class="entries">\n${ws.map(entry).join('\n')}\n    </ul>\n  </section>`)
    .join('\n');
  const kana = `    <nav class="kana">${groups.map(([g]) => `<a href="#gyou-${g}">${g}</a>`).join('')}</nav>`;
  const rounds = puzzles.length
    ? puzzles.map((p) => `<a href="${pageName(p)}">第${p.round ?? 1}回</a>`).join('・')
    : 'まだありません';
  const head = `      ${image ? `<img src="images/${escapeHtml(image)}" alt="" width="120" height="120">` : ''}
      <ul class="facts">
        <li>${words.length} 語</li>
        <li>パズル: ${rounds}</li>
        <li><a href="${escapeHtml(jsonName)}" download>単語リスト（JSON）をダウンロード</a></li>
      </ul>`;
  const heading = theme.filler ? 'つなぎの言葉の単語帳' : `${theme.title}の単語帳`;
  const description = theme.filler
    ? '盤面のすき間を埋めるために、どのジャンルのクロスワードにも入ることがある身近な言葉です。'
    : theme.description;
  const html = template
    .replace('__TITLE__', `${escapeHtml(heading)}｜${escapeHtml(site.name)}`)
    .replace('__DESCRIPTION__', escapeHtml(description))
    .replace('__HEADING__', escapeHtml(heading))
    .replace('__SUBTITLE__', escapeHtml(theme.subtitle ?? ''))
    .replace('__BOOK_DESCRIPTION__', escapeHtml(description))
    .replace('<!--__BOOK_HEAD__-->', () => head)
    .replace('<!--__KANA_INDEX__-->', () => kana)
    .replace('<!--__ENTRIES__-->', () => entries);
  return fillCommon(html, { parts, site, current: null });
}

// 単語帳の一覧。books: [{ theme, image, puzzleCount }]（つなぎの言葉は最後）
export function renderWordsIndexHtml({ template, parts, site, books }) {
  const sorted = [...books].sort((a, b) => Number(a.theme.filler ?? false) - Number(b.theme.filler ?? false));
  const cards = sorted
    .map(({ theme, image, puzzleCount }) => {
      const title = theme.filler ? 'つなぎの言葉' : theme.title;
      return `    <li><a class="card" href="${wordsPageName(theme.theme)}">
      ${image ? `<img src="images/${escapeHtml(image)}" alt="" loading="lazy" width="88" height="88">` : ''}
      <div>
        <p class="title">${escapeHtml(title)}の単語帳</p>
        <p class="en">${escapeHtml(theme.subtitle ?? '')}</p>
        <p class="meta">${theme.words.length} 語${theme.filler ? '' : `・パズル ${puzzleCount} 回`}</p>
      </div>
    </a></li>`;
    })
    .join('\n');
  const html = template.replace('<!--__CARDS__-->', () => `  <ul class="cards">\n${cards}\n  </ul>`);
  return fillCommon(html, { parts, site, current: 'words.html' });
}

// 単語帳からダウンロードできる JSON。作る側のメモ（note）は入れない
export function publicWordList(theme) {
  return {
    locale: theme.locale,
    theme: theme.theme,
    title: theme.title,
    subtitle: theme.subtitle,
    description: theme.description,
    rules: theme.rules ?? [],
    words: theme.words.map(({ answer, display, level, clue, explanation }) => ({ answer, display, level, clue, explanation })),
  };
}
