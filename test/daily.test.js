// Lambda の中身（generator/daily.js）を、S3 の代わりにメモリ上の入れ物で確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runDaily, pickRandomGenre, todayIn, contentTypeOf } from '../generator/daily.js';
import { loadSiteSources } from '../generator/lib/site-sources.js';
import * as ja from '../generator/locales/ja.js';

function memoryBucket(initial = {}) {
  const objects = new Map(Object.entries(initial));
  const puts = [];
  return {
    objects,
    puts,
    async list(prefix) { return [...objects.keys()].filter((k) => k.startsWith(prefix)); },
    async get(key) { return objects.get(key) ?? null; },
    async put(key, body, opts = {}) {
      if (opts.ifNoneMatch && objects.has(key)) throw new Error(`すでにある: ${key}`);
      objects.set(key, body);
      puts.push({ key, ...opts });
    },
  };
}

async function setup({ schedule, puzzles = true } = {}) {
  const read = (f) => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
  const data = { 'site/ja.json': await read('data/site/ja.json') };
  for (const f of await readdir(new URL('../data/words/ja/', import.meta.url))) data[`words/ja/${f}`] = await read(`data/words/ja/${f}`);
  if (puzzles) for (const f of await readdir(new URL('../puzzles/', import.meta.url))) data[`puzzles/ja/${f}`] = await read(`puzzles/${f}`);
  if (schedule) data['schedule/ja.json'] = JSON.stringify({ days: schedule });
  const site = {};
  for (const f of await readdir(new URL('../data/images/', import.meta.url))) site[`images/${f}`] = 'x';
  const invalidations = [];
  const store = { data: memoryBucket(data), site: memoryBucket(site), async invalidate(p) { invalidations.push(p); } };
  return { store, invalidations, sources: await loadSiteSources('ja') };
}

test('Lambda: ジャンルを指定して作り、保存してページを公開する', async () => {
  const { store, invalidations, sources } = await setup();
  const r = await runDaily({ store, sources, locale: ja, genre: 'sangetsuki', date: '2026-10-12' });
  assert.equal(r.id, '00005-sangetsuki-002');
  assert.equal(r.source, 'event');
  const saved = JSON.parse(store.data.objects.get('puzzles/ja/00005-sangetsuki-002.json'));
  assert.equal(saved.date, '2026-10-12');
  assert.ok(store.site.objects.get('00005-sangetsuki-002.html').includes('山月記のクロスワードパズル 第2回'));
  assert.match(store.site.objects.get('index.html'), /山月記のクロスワードパズル 第2回/);
  assert.match(store.site.objects.get('sitemap.xml'), /00005-sangetsuki-002\.html/);
  assert.equal(store.site.puts.find((p) => p.key === 'llms.txt').contentType, 'text/plain; charset=utf-8');
  assert.deepEqual(invalidations, [['/*']]);
  // 同じ日でも、ジャンルを指定すれば何問でも作れる
  const r2 = await runDaily({ store, sources, locale: ja, genre: 'animals', date: '2026-10-12' });
  assert.equal(r2.id, '00006-animals-002');
});

test('Lambda: 指定がなければ予定表、なければランダム。その日の問題があれば作らない', async () => {
  const { store, sources } = await setup({ schedule: { '2026-10-12': 'programming_languages' } });
  const r = await runDaily({ store, sources, locale: ja, date: '2026-10-12' });
  assert.equal(r.source, 'schedule');
  assert.equal(r.id, '00005-programming_languages-002');
  const again = await runDaily({ store, sources, locale: ja, date: '2026-10-12' });
  assert.equal(again.skipped, true);
  // ランダムに選ばれるのは、カギのある言葉が十分あるジャンルだけ。直前の回と同じジャンルは避ける
  const r3 = await runDaily({ store, sources, locale: ja, date: '2026-10-13', random: () => 0.99 });
  assert.equal(r3.source, 'random');
  assert.equal(r3.genre, 'sangetsuki');
  // カギのある言葉だけを使う
  const saved = JSON.parse(store.data.objects.get(`puzzles/ja/${r3.id}.json`));
  assert.ok(saved.words.every((w) => w.clue), 'カギのない言葉がある');
});

test('Lambda: dryRun は保存も公開もしない。パズルがなくても 1 問目から作れる', async () => {
  const { store, invalidations, sources } = await setup({ puzzles: false });
  const r = await runDaily({ store, sources, locale: ja, genre: 'animals', date: '2026-10-12', dryRun: true });
  assert.equal(r.id, '00001-animals-001');
  assert.equal(store.data.puts.length + store.site.puts.length + invalidations.length, 0);
  await assert.rejects(runDaily({ store, sources, locale: ja, genre: 'general', date: '2026-10-12' }), /つなぎの言葉/);
  await assert.rejects(runDaily({ store, sources, locale: ja, genre: 'nothing', date: '2026-10-12' }), /単語リストがありません/);
});

test('Lambda: rebuild は新しい問題を作らず、今あるパズルでページを作り直す', async () => {
  const { store, invalidations, sources } = await setup();
  const before = store.data.objects.size;
  const r = await runDaily({ store, sources, locale: ja, rebuild: true, date: '2026-10-11' });
  assert.equal(r.rebuilt, true);
  assert.equal(store.data.objects.size, before);
  assert.match(store.site.objects.get('index.html'), /プログラミング言語のクロスワードパズル 第1回/);
  assert.deepEqual(invalidations, [['/*']]);
  const empty = await setup({ puzzles: false });
  await assert.rejects(runDaily({ store: empty.store, sources: empty.sources, locale: ja, rebuild: true }), /1 問もない/);
});

test('ランダムのジャンル選び・今日の日付・ファイルの種類', () => {
  const themes = [
    { theme: 'a', words: Array(40).fill({ clue: 'x' }) },
    { theme: 'b', words: Array(40).fill({ clue: 'x' }) },
    { theme: 'small', words: Array(5).fill({ clue: 'x' }) },
    { theme: 'general', filler: true, words: Array(400).fill({ clue: 'x' }) },
  ];
  for (let i = 0; i < 20; i++) assert.equal(pickRandomGenre({ themes, puzzles: [{ serial: 1, genre: 'a' }], random: Math.random }), 'b');
  assert.equal(pickRandomGenre({ themes: themes.slice(0, 1), puzzles: [{ serial: 1, genre: 'a' }] }), 'a');
  // カギのない言葉は数えない
  assert.throws(() => pickRandomGenre({ themes: [{ theme: 'c', words: Array(40).fill({}) }], puzzles: [] }), /選べるジャンルがありません/);
  assert.equal(todayIn('Asia/Tokyo', new Date('2026-10-11T15:30:00Z')), '2026-10-12');
  assert.equal(contentTypeOf('a.webp'), 'image/webp');
});
