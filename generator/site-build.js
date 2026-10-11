// サイトのページをまとめて作る。ファイル操作はしない（手元の npm run site と Lambda の両方から使う）。
//
//   <ID>.html                パズルのページ（例: 00001-countries-001.html）
//   index.html               いちばん新しいパズル（通し番号が最大のもの）
//   archive.html             バックナンバー（一覧）
//   words.html               単語帳の一覧
//   words-<ジャンル>.html / .json  ジャンルの単語帳と、そのダウンロード用 JSON
//   privacy.html・consent-gate.js・consent.js  プライバシーポリシーと計測の同意
//   sitemap.xml・robots.txt・llms.txt  検索エンジンと AI 向けの案内（site.baseUrl があるとき）
//
// 絵（images/）はここでは作らない。呼び出し側が置く。

import {
  renderPuzzleHtml, renderArchiveHtml, renderWordsHtml, renderWordsIndexHtml, renderPrivacyHtml,
  publicWordList, pageName, wordsPageName, puzzleHeading, DEFAULT_IMAGE,
} from './site.js';
import { renderSitemap, renderRobots, renderLlmsTxt } from './seo.js';
import { langFor } from './scripts/index.js';

/**
 * @param {object} options
 * @param {object} options.locale    locales/<locale>.js のモジュール
 * @param {object} options.site      data/site/<locale>.json
 * @param {object} options.sources   lib/site-sources.js の loadSiteSources の結果（テンプレートなど）
 * @param {object[]} options.puzzles このロケールのパズル
 * @param {object[]} options.themes  このロケールのテーマファイル
 * @param {string[]} options.images  使える絵のファイル名（images/ の中。*.thumb.webp も含む）
 * @returns {{ files: {name:string, body:string}[], warnings: string[] }}
 */
export function buildSitePages({ locale, site, sources, puzzles, themes, images }) {
  const files = [];
  const warnings = [];
  const out = (name, body) => files.push({ name, body });
  const { templates, parts } = sources;

  // 表紙に使える絵（一覧用の小さい絵 *.thumb.webp は除く）
  const imageFiles = images.filter((f) => /\.(webp|svg)$/i.test(f) && !f.includes('.thumb.'));
  const thumbFor = (image) => {
    const thumb = image.replace(/\.webp$/, '.thumb.webp');
    return thumb !== image && images.includes(thumb) ? thumb : image;
  };

  puzzles = [...puzzles].sort((a, b) => a.serial - b.serial);
  // 絵はジャンル（テーマ）ごとに 1 枚。テーマファイルの image を使い、なければ方眼紙
  const themeImages = new Map(themes.filter((t) => t.image).map((t) => [t.theme, t.image]));
  const imageFor = (puzzle) => {
    const image = themeImages.get(puzzle.theme.split('+')[0]);
    if (image && imageFiles.includes(image)) return image;
    if (image) warnings.push(`${puzzle.id}: テーマの絵 ${image} がまだありません（npm run theme-image）`);
    return DEFAULT_IMAGE;
  };

  const latest = puzzles.at(-1);
  for (const puzzle of puzzles) {
    const missing = puzzle.words.filter((w) => !w.clue).length;
    if (missing) warnings.push(`${puzzle.id}: カギのない単語が ${missing} 語あります`);
    const related = puzzles
      .filter((p) => p.theme === puzzle.theme && p.id !== puzzle.id)
      .sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
    const args = { template: templates.puzzle, parts, puzzle, localeSource: sources.pageSource(puzzle.script), site, image: imageFor(puzzle), related };
    out(pageName(puzzle), renderPuzzleHtml(args));
    if (puzzle === latest) {
      // トップページ: 最新の問題と、その前の最近の 3 問
      const recent = puzzles.filter((p) => p !== puzzle).slice(-3).reverse();
      out('index.html', renderPuzzleHtml({ ...args, recent, isLatest: true }));
    }
  }
  const entries = puzzles.map((puzzle) => ({ puzzle, image: thumbFor(imageFor(puzzle)) }));
  out('archive.html', renderArchiveHtml({ template: templates.archive, parts, site, entries, themeFiles: new Map(themes.map((t) => [t.theme, t])) }));

  // 単語帳
  const books = [];
  for (const theme of themes) {
    const genrePuzzles = puzzles.filter((p) => p.theme.split('+')[0] === theme.theme).sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
    const hasImage = theme.image && imageFiles.includes(theme.image);
    const image = hasImage ? thumbFor(theme.image) : null;
    const jsonName = `words-${theme.theme}.json`;
    out(jsonName, `${JSON.stringify(publicWordList(theme), null, 2)}\n`);
    out(wordsPageName(theme.theme), renderWordsHtml({
      template: templates.words, parts, site, theme, puzzles: genrePuzzles, image, shareImage: hasImage ? theme.image : null, jsonName,
      lang: langFor(locale, theme.script),
    }));
    books.push({ theme, image, puzzleCount: genrePuzzles.length, lastmod: genrePuzzles.map((p) => p.date).sort().at(-1) });
  }
  out('words.html', renderWordsIndexHtml({ template: templates.wordsIndex, parts, site, books }));

  // プライバシーポリシーと計測の同意
  out('consent-gate.js', sources.consentGate);
  out('consent.js', sources.consent);
  out('privacy.html', renderPrivacyHtml({ template: templates.privacy, parts, site }));

  // 検索エンジンと AI 向けの案内
  if (site.baseUrl) {
    const newest = latest?.date;
    const pages = [
      { path: 'index.html', lastmod: newest },
      { path: 'archive.html', lastmod: newest },
      { path: 'words.html', lastmod: newest },
      { path: 'privacy.html' },
      ...[...puzzles].reverse().map((p) => ({ path: pageName(p), lastmod: p.date })),
      ...books.map(({ theme, lastmod }) => ({ path: wordsPageName(theme.theme), lastmod })),
    ];
    out('sitemap.xml', renderSitemap(site, pages));
    out('robots.txt', renderRobots(site));
    out('llms.txt', renderLlmsTxt({ site, puzzles, themes, pageName, wordsPageName, puzzleHeading }));
  } else {
    warnings.push('site の baseUrl がないので、sitemap.xml・robots.txt・llms.txt は作りません');
  }
  return { files, warnings };
}
