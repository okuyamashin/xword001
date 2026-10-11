// パズルを 1 問作って公開する（Lambda の中身）。S3 には直接さわらず、store を通して読み書きする。
//
// データ（非公開）:
//   site/<locale>.json             サイトの設定（data/site/<locale>.json）
//   words/<locale>/<ジャンル>.json  単語リスト（data/words/<locale>/）
//   schedule/<locale>.json         予定表（data/schedule/<locale>.json）。なくてもよい
//   puzzles/<locale>/<ID>.json     作ったパズル。ここが問題の一覧の本体
// 公開:
//   <ページ>                        generator/site-build.js が作るもの
//   images/                         絵（GitHub から npm run deploy で上げる。ここでは読むだけ）
//
// ジャンルの決め方: event で指定 → 予定表のその日 → ランダム（直前の回と同じジャンルは避ける）

import { buildPuzzle, nextNumbers, genreOf, GENRE_PATTERN } from './build.js';
import { buildSitePages } from './site-build.js';
import { scriptOf } from './scripts/index.js';

// ランダムで選ぶとき、カギのある言葉がこれより少ないジャンルは選ばない
export const MIN_WORDS = 30;

// Lambda が使うのはカギのある言葉だけ（カギのない言葉が盤面に入らないように）
const hasClue = (w) => Boolean(w.clue);

/**
 * store:
 *   data.list(prefix) → キーの配列       data.get(key) → 文字列（なければ null）
 *   data.put(key, body, { ifNoneMatch }) ifNoneMatch のときは、すでにあれば失敗する
 *   site.list(prefix) → キーの配列       site.put(key, body, { contentType, cacheControl })
 *   invalidate(paths)                    CDN のキャッシュを消す
 *
 * @param {object} options
 * @param {object} options.store
 * @param {object} options.sources       lib/site-sources.js の loadSiteSources の結果
 * @param {object} options.locale        locales/<locale>.js のモジュール
 * @param {string} [options.date]        作った日（YYYY-MM-DD）。省略時はサイトのタイムゾーンで今日
 * @param {string} [options.genre]       ジャンル（例: sangetsuki）。省略時は予定表かランダム
 * @param {boolean} [options.force]      ジャンルを指定しないときでも、その日の問題がすでにあっても作る
 * @param {boolean} [options.dryRun]     作るだけで、保存も公開もしない
 * @param {boolean} [options.rebuild]    新しい問題は作らず、今あるパズルでページだけ作り直す
 * @param {() => number} [options.random]
 * @param {Date} [options.now]
 */
export async function runDaily({ store, sources, locale, date, genre, force = false, dryRun = false, rebuild = false, random = Math.random, now = new Date() }) {
  const loc = locale.locale;
  const getJson = async (key) => {
    const text = await store.data.get(key);
    return text == null ? null : JSON.parse(text);
  };
  const site = await getJson(`site/${loc}.json`);
  if (!site) throw new Error(`サイトの設定 site/${loc}.json がありません（npm run deploy で上げる）`);
  date ??= todayIn(site.timeZone ?? 'Asia/Tokyo', now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`日付の形がちがう: ${date}`);

  const themes = await loadAll(store, `words/${loc}/`, getJson);
  const puzzles = (await loadAll(store, `puzzles/${loc}/`, getJson)).filter((p) => p.locale === loc);
  if (!themes.length) throw new Error(`単語リスト words/${loc}/ がありません（npm run deploy で上げる）`);

  // 新しい問題は作らない。単語リストを上げたあとに、今あるパズルでページだけ作り直す。
  if (rebuild) {
    const published = await publishSite({ store, sources, locale, site, puzzles, themes });
    return { rebuilt: true, date, ...published };
  }

  // ジャンルを決める
  let source = 'event';
  if (!genre) {
    if (!force && puzzles.some((p) => p.date === date)) {
      return { skipped: true, reason: `${date} の問題はもうあります`, date };
    }
    const schedule = await getJson(`schedule/${loc}.json`);
    genre = schedule?.days?.[date];
    source = 'schedule';
    if (!genre) {
      genre = pickRandomGenre({ themes, puzzles, random });
      source = 'random';
    }
  }

  const usable = (t) => ({ ...t, words: t.words.filter(hasClue).map((w) => ({ ...w, theme: t.theme })) });
  const themeFiles = genre.split('+').map((id) => {
    const t = themes.find((x) => x.theme === id);
    if (!t) throw new Error(`ジャンル ${id} の単語リストがありません`);
    if (t.filler) throw new Error(`${id} はつなぎの言葉なので、ジャンルにはできません`);
    return usable(t);
  });
  if (!themeFiles.some((t) => t.words.length)) throw new Error(`${genre} にはカギのある言葉がありません`);
  const filler = themes.find((t) => t.theme === scriptOf(themeFiles[0].script).fillerTheme);
  const generalFile = filler ? usable(filler) : null;
  const { serial, round } = nextNumbers(puzzles, { locale: loc, genre: genreOf(themeFiles) });
  const { puzzle, stats } = buildPuzzle({ serial, round, date, locale: loc, themeFiles, generalFile });
  const result = { id: puzzle.id, genre: puzzle.genre, date, source, stats };
  if (dryRun) return { ...result, dryRun: true, grid: puzzle.grid };

  // 保存（同じ ID がすでにあれば失敗する。同時に 2 つ動いたときの番号のぶつかりを防ぐ）
  await store.data.put(`puzzles/${loc}/${puzzle.id}.json`, `${JSON.stringify(puzzle, null, 2)}\n`, { ifNoneMatch: true });

  const published = await publishSite({ store, sources, locale, site, puzzles: [...puzzles, puzzle], themes });
  return { ...result, ...published };
}

// 今あるパズルで公開ページを作り直す。パズルが 1 問もなければ止め、空のサイトで上書きしない。
async function publishSite({ store, sources, locale, site, puzzles, themes }) {
  if (!puzzles.length) throw new Error('パズルが 1 問もないので、ページは作り直しません');
  const images = (await store.site.list('images/')).map((k) => k.slice('images/'.length));
  const { files, warnings } = buildSitePages({ locale, site, sources, puzzles, themes, images });
  for (const { name, body } of files) {
    await store.site.put(name, body, { contentType: contentTypeOf(name), cacheControl: PAGE_CACHE });
  }
  await store.invalidate(['/*']);
  return { pages: files.length, warnings };
}

// ページと JSON のキャッシュ（npm run deploy と同じ）
export const PAGE_CACHE = 'public, max-age=300';

export function contentTypeOf(name) {
  const ext = name.split('.').pop().toLowerCase();
  return {
    html: 'text/html; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }[ext] ?? 'application/octet-stream';
}

// ランダムに選べるジャンル: つなぎの言葉でなく、カギのある言葉が MIN_WORDS 語以上。直前の回と同じジャンルは（ほかにあれば）避ける
export function pickRandomGenre({ themes, puzzles, random = Math.random }) {
  const candidates = themes
    .filter((t) => !t.filler && GENRE_PATTERN.test(t.theme) && t.words.filter(hasClue).length >= MIN_WORDS)
    .map((t) => t.theme);
  if (!candidates.length) throw new Error('ランダムに選べるジャンルがありません');
  const last = [...puzzles].sort((a, b) => a.serial - b.serial).at(-1)?.genre;
  const pool = candidates.length > 1 ? candidates.filter((g) => g !== last) : candidates;
  return pool[Math.floor(random() * pool.length)];
}

// タイムゾーンでの今日（YYYY-MM-DD）
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

async function loadAll(store, prefix, getJson) {
  const keys = (await store.data.list(prefix)).filter((k) => k.endsWith('.json')).sort();
  return Promise.all(keys.map((k) => getJson(k)));
}
