// 何日分か組んでみて、語数・汎用語の数・失敗数を集計する
// 使い方: node generator/cli/trial.js [--theme countries] [--days 30]

import { parseArgs } from 'node:util';
import { buildPuzzle } from '../build.js';
import { loadThemeFile } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    theme: { type: 'string', default: 'countries' },
    locale: { type: 'string', default: 'ja' },
    days: { type: 'string', default: '30' },
  },
});

const themeFiles = await Promise.all(values.theme.split('+').map((t) => loadThemeFile(values.locale, t)));
const generalFile = await loadThemeFile(values.locale, 'general');
const days = Number(values.days);
const tally = { words: [], general: [], crossings: [], filled: [], failed: 0 };
const start = new Date('2026-10-12');
const t0 = Date.now();
for (let i = 0; i < days; i++) {
  const date = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
  try {
    const { stats } = buildPuzzle({ serial: i + 1, round: 1, date, seed: `trial-${date}`, locale: values.locale, themeFiles, generalFile });
    tally.words.push(stats.words);
    tally.general.push(stats.generalCount);
    tally.crossings.push(stats.crossings);
    tally.filled.push(stats.filled);
  } catch (e) {
    tally.failed++;
    console.error(date, e.message);
  }
}
const summary = (a) => (a.length ? `平均 ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}（最小 ${Math.min(...a)}・最大 ${Math.max(...a)}）` : '-');
console.log(`テーマ: ${values.theme}  ${days}日分  1問あたり ${((Date.now() - t0) / days).toFixed(0)}ms`);
console.log(`語数:       ${summary(tally.words)}`);
console.log(`汎用語:     ${summary(tally.general)}`);
console.log(`交差マス:   ${summary(tally.crossings)}`);
console.log(`文字のマス: ${summary(tally.filled)} / 81`);
console.log(`失敗:       ${tally.failed}`);
