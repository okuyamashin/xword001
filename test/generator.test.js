import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../generator/scripts/kana.js';
import * as latin from '../generator/scripts/latin.js';
import { scriptOf } from '../generator/scripts/index.js';
import { buildPuzzle } from '../generator/build.js';
import { validatePuzzle } from '../generator/lib/validate.js';
import { loadThemeFile } from '../generator/lib/words.js';

test('アルファベットの正規化と答えの漏れの点検', () => {
  assert.equal(latin.normalize('Python'), 'PYTHON');
  assert.equal(latin.normalize('PL/SQL'), 'PLSQL');
  assert.equal(latin.normalize('ｒｕｂｙ'), 'RUBY');
  assert.equal(latin.normalize('Café'), 'CAFE');
  assert.ok(latin.isValidAnswer('GO'));
  assert.ok(!latin.isValidAnswer('C#'));
  const go = { answer: 'GO', display: 'Go' };
  assert.equal(latin.leaksAnswer('Googleで開発された言語', go), null); // GOOGLE は GO ではない
  assert.match(latin.leaksAnswer('go言語とも呼ばれる', go), /答え/);
  assert.match(latin.leaksAnswer('Go 1.0 は2012年', go), /答え/);
  assert.match(latin.leaksAnswer('C#と同じく.NETで動く', { answer: 'CSHARP', display: 'C#' }), /表記/);
  assert.equal(latin.leaksAnswer('C言語にクラスを加えた', { answer: 'CPLUSPLUS', display: 'C++' }), null);
});

test('日本語の正規化', () => {
  assert.equal(normalize('しゃつ'), 'シヤツ');
  assert.equal(normalize('ヴァイオリン'), 'バイオリン');
  assert.equal(normalize('ヴェトナム'), 'ベトナム');
  assert.equal(normalize('サントメ・プリンシペ'), 'サントメプリンシペ');
  assert.equal(normalize('ｶﾞｲｱﾅ'), 'ガイアナ');
});

test('単語リストの answer はすべて、それぞれの文字種で正規化済み', async () => {
  const { readdir } = await import('node:fs/promises');
  const themes = (await readdir(new URL('../data/words/ja/', import.meta.url))).map((f) => f.replace(/\.json$/, ''));
  assert.ok(themes.length >= 3);
  for (const theme of themes) {
    const file = await loadThemeFile('ja', theme);
    const script = scriptOf(file.script);
    for (const w of file.words) {
      assert.ok(script.isValidAnswer(w.answer), `${theme}: ${w.answer}`);
      assert.equal(script.normalize(w.answer), w.answer, `${theme}: ${w.answer}`);
    }
  }
});

test('同じ番号からは同じパズルができ、IDは命名ルールどおりで、検証を通る', async () => {
  const themeFiles = [await loadThemeFile('ja', 'countries')];
  const generalFile = await loadThemeFile('ja', 'general');
  const layout = { attempts: 30 };
  const a = buildPuzzle({ serial: 1, round: 1, date: '2026-10-12', locale: 'ja', themeFiles, generalFile, layout });
  const b = buildPuzzle({ serial: 1, round: 1, date: '2026-10-12', locale: 'ja', themeFiles, generalFile, layout });
  assert.deepEqual(a.puzzle, b.puzzle);
  assert.equal(a.puzzle.id, '00001-countries-001');
  assert.deepEqual(validatePuzzle(a.puzzle), []);
  assert.ok(a.stats.generalCount <= 2);
});

test('検証は意図しない並びを見つける', () => {
  const puzzle = {
    grid: ['アイ#', 'ウ##', '###'],
    words: [{ number: 1, direction: 'across', row: 0, col: 0, answer: 'アイ' }],
  };
  assert.ok(validatePuzzle(puzzle).length > 0);
});

test('パズルを作るとき、単語リストのカギと解説を書き写す（AI を使わない）', async () => {
  const themeFiles = [await loadThemeFile('ja', 'sangetsuki')];
  const generalFile = await loadThemeFile('ja', 'general');
  const { puzzle } = buildPuzzle({ serial: 9, round: 1, date: '2026-10-15', locale: 'ja', themeFiles, generalFile, layout: { attempts: 30 } });
  for (const w of puzzle.words.filter((x) => x.theme === 'sangetsuki')) {
    assert.ok(w.clue, `${w.display} のカギ`);
    assert.ok(w.explanation, `${w.display} の解説`);
  }
  assert.equal(puzzle.description, themeFiles[0].description);
});

test('すべての単語リストが点検を通る（山月記はカギと解説までそろっている）', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const { checkTheme } = await import('../generator/lib/theme-check.js');
  const ja = await import('../generator/locales/ja.js');
  const dir = new URL('../data/words/ja/', import.meta.url);
  const site = JSON.parse(await readFile(new URL('../data/site/ja.json', import.meta.url), 'utf8'));
  const imageFiles = await readdir(new URL('../data/images/', import.meta.url));
  for (const fileName of await readdir(dir)) {
    const doc = JSON.parse(await readFile(new URL(fileName, dir), 'utf8'));
    const strict = doc.theme === 'sangetsuki';
    const { errors } = checkTheme(doc, { locale: ja, site, imageFiles, fileName, strict });
    assert.deepEqual(errors, [], fileName);
  }
});

test('サイトのページを作れる（トップページに最近の問題、バックナンバーにジャンルの説明と単語帳へのリンク）', async () => {
  const { mkdtemp, readFile, readdir } = await import('node:fs/promises');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const os = await import('node:os');
  const path = await import('node:path');
  const out = await mkdtemp(path.join(os.tmpdir(), 'xword-site-'));
  await promisify(execFile)(process.execPath, ['generator/cli/build-site.js', '--out', out], { cwd: new URL('..', import.meta.url) });
  const files = await readdir(out);
  for (const f of ['index.html', 'archive.html', 'words.html']) assert.ok(files.includes(f), f);
  const index = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(index, /最近のクロスワード/);
  assert.match(index, /href="archive.html">バックナンバーをすべて見る/);
  const archive = await readFile(path.join(out, 'archive.html'), 'utf8');
  assert.match(archive, /<p class="genre">.*の単語帳を見る/);
  // 検索エンジンと AI 向け
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt']) assert.ok(files.includes(f), f);
  const sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/xword\.engawa5656\.com\/<\/loc>/);
  for (const f of files.filter((f) => f.endsWith('.html') && f !== 'index.html')) assert.ok(sitemap.includes(`/${f}</loc>`), `sitemap に ${f}`);
  assert.match(await readFile(path.join(out, 'robots.txt'), 'utf8'), /^Sitemap: https:\/\/xword\.engawa5656\.com\/sitemap\.xml$/m);
  const llms = await readFile(path.join(out, 'llms.txt'), 'utf8');
  assert.match(llms, /^# よろずのクロスワードパズル\n\n> /);
  assert.match(llms, /\(https:\/\/xword\.engawa5656\.com\/words-sangetsuki\.json\)/);
  assert.match(index, /<link rel="canonical" href="https:\/\/xword\.engawa5656\.com\/">/);
  assert.match(index, /"@type":"WebSite"/);
  assert.match(archive, /<link rel="canonical" href="https:\/\/xword\.engawa5656\.com\/archive\.html">/);
});

test('SEO: 絶対 URL・OGP・サイトマップ', async () => {
  const { absoluteUrl, renderHeadMeta, renderSitemap } = await import('../generator/seo.js');
  const site = { name: 'テスト&サイト', baseUrl: 'https://example.com' };
  assert.equal(absoluteUrl(site, 'index.html'), 'https://example.com/');
  assert.equal(absoluteUrl({ ...site, baseUrl: 'https://example.com/' }, 'a.html'), 'https://example.com/a.html');
  const head = renderHeadMeta({ site, path: 'a.html', title: '"題"', description: 'x', image: 'images/default.svg' });
  assert.match(head, /og:site_name" content="テスト&amp;サイト"/);
  assert.match(head, /og:title" content="&quot;題&quot;"/);
  assert.doesNotMatch(head, /og:image/); // SVG は SNS が読めないので入れない
  assert.match(renderHeadMeta({ site, path: 'a.html', title: 't', description: 'x', image: 'images/a.webp' }), /og:image" content="https:\/\/example\.com\/images\/a\.webp"/);
  const xml = renderSitemap(site, [{ path: 'index.html', lastmod: '2026-10-11' }, { path: 'a.html' }]);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>\n    <lastmod>2026-10-11<\/lastmod>/);
  assert.doesNotMatch(xml.split('a.html')[1], /lastmod/);
});
