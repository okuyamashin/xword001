// 検索エンジンと AI 向けのファイル（sitemap.xml・robots.txt・llms.txt）と、
// ページの <head> に入れる情報（canonical・OGP・構造化データ）を作る。ファイル操作はしない。
//
// site.baseUrl（data/site/<locale>.json）が本番のアドレス。末尾の / はあってもなくてもよい。

// サイト内のパス（例: "archive.html"）を絶対 URL にする。トップページ（index.html）は "/" にそろえる
export function absoluteUrl(site, pathName = '') {
  const base = site.baseUrl.replace(/\/+$/, '');
  const p = pathName === 'index.html' ? '' : pathName.replace(/^\/+/, '');
  return `${base}/${p}`;
}

/**
 * <head> に入れるタグ。
 * @param {object} options
 * @param {object} options.site
 * @param {string} options.path         このページのパス（index.html なら "/"）
 * @param {string} options.title
 * @param {string} options.description
 * @param {string} [options.image]      site/ の中の絵のパス（例: "images/animals.webp"）。SVG は SNS が読めないので使わない
 * @param {string} [options.type]       og:type（website / article）
 * @param {object[]} [options.jsonLd]   構造化データ（schema.org）
 */
export function renderHeadMeta({ site, path: pathName, title, description, image, type = 'website', jsonLd = [] }) {
  const url = absoluteUrl(site, pathName);
  const img = image && !/\.svg$/i.test(image) ? absoluteUrl(site, image) : null;
  const tags = [
    `<link rel="canonical" href="${escapeAttr(url)}">`,
    `<meta property="og:site_name" content="${escapeAttr(site.name)}">`,
    `<meta property="og:locale" content="${escapeAttr(site.ogLocale ?? 'ja_JP')}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    ...(img ? [`<meta property="og:image" content="${escapeAttr(img)}">`, `<meta property="og:image:alt" content="${escapeAttr(title)}">`] : []),
    `<meta name="twitter:card" content="summary">`,
    ...jsonLd.map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`),
  ];
  return tags.join('\n');
}

// 構造化データ: サイト（トップページに入れる）
export function websiteJsonLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    alternateName: site.alternateName,
    description: site.description,
    url: absoluteUrl(site, ''),
    inLanguage: site.lang ?? 'ja',
  };
}

// 構造化データ: パンくず。items: [{ name, path }]（最後がこのページ）
export function breadcrumbJsonLd(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(site, item.path),
    })),
  };
}

/**
 * sitemap.xml
 * @param {object} site
 * @param {{path:string, lastmod?:string}[]} pages  lastmod は YYYY-MM-DD
 */
export function renderSitemap(site, pages) {
  const urls = pages
    .map(({ path: p, lastmod }) => `  <url>\n    <loc>${escapeXml(absoluteUrl(site, p))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// robots.txt。どこでも読んでよい。サイトマップの場所を書く
export function renderRobots(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(site, 'sitemap.xml')}\n`;
}

/**
 * llms.txt（https://llmstxt.org/ の形）。AI がサイトの中身をつかむための案内
 * @param {object} options
 * @param {object} options.site
 * @param {object[]} options.puzzles   パズル（通し番号の順）
 * @param {object[]} options.themes    テーマファイル（つなぎの言葉も含む）
 * @param {(p:object) => string} options.pageName
 * @param {(theme:string) => string} options.wordsPageName
 * @param {(p:object) => string} options.puzzleHeading
 */
export function renderLlmsTxt({ site, puzzles, themes, pageName, wordsPageName, puzzleHeading }) {
  const url = (p) => absoluteUrl(site, p);
  const link = (name, p, note) => `- [${name}](${url(p)})${note ? `: ${note}` : ''}`;
  const newest = [...puzzles].sort((a, b) => b.serial - a.serial);
  const genres = themes.filter((t) => !t.filler);
  const fillers = themes.filter((t) => t.filler);
  const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
  const lines = [
    `# ${site.name}`,
    '',
    `> ${oneLine(site.description)}`,
    '',
    ...(site.about ?? []).map((line) => `- ${line}`),
    '',
    '## ページ',
    '',
    link('最新の問題（トップページ）', 'index.html', 'いちばん新しいクロスワードと、最近の問題へのリンク'),
    link('バックナンバー', 'archive.html', 'これまでのクロスワードを、新しい順とテーマごとに一覧'),
    link('単語帳', 'words.html', 'ジャンルごとの単語帳の一覧'),
    '',
    '## クロスワード',
    '',
    ...newest.map((p) => link(`${puzzleHeading(p)} 第${p.round ?? 1}回`, pageName(p), `${p.date}。${oneLine(p.description)}`)),
    '',
    '## 単語帳',
    '',
    ...genres.flatMap((t) => [
      link(`${t.title}の単語帳`, wordsPageName(t.theme), `${t.words.length} 語。${oneLine(t.description)}`),
      link(`${t.title}の単語リスト（JSON）`, `words-${t.theme}.json`, '言葉・読み・難しさ・カギ・解説'),
    ]),
    '',
    '## Optional',
    '',
    ...fillers.flatMap((t) => [
      link('つなぎの言葉の単語帳', wordsPageName(t.theme), `${t.words.length} 語。盤面のすき間を埋めるために、どのジャンルにも入ることがある身近な言葉`),
      link('つなぎの言葉の単語リスト（JSON）', `words-${t.theme}.json`),
    ]),
    link('サイトマップ', 'sitemap.xml'),
  ];
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function escapeAttr(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}
