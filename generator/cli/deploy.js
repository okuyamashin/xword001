// GitHub から本番へ上げる。パズルと公開ページは上げない（Lambda が毎日作って S3 に置く）。
// 上げるもの:
//   単語リスト   data/words/<locale>/  → データ用バケット words/<locale>/
//   サイトの設定 data/site/<locale>.json → site/<locale>.json
//   予定表       data/schedule/<locale>.json → schedule/<locale>.json
//   絵           data/images/ の WebP・SVG → 公開用バケット images/
// リポジトリの puzzles/ は、データ用バケットに同じキーが無いときだけ足す（上書きしない）。
// ページの作り直しは Lambda に {"rebuild":true} を渡す。手元の puzzles/ で公開バケットを --delete しない。
//
// 使い方:
//   npm run deploy -- --bucket xword-engawa5656 --data-bucket xword-data-engawa5656 --distribution EPMSPX74FLDVH --function xword-daily
//     --dryrun       何が送られるかを表示するだけ
//     --print        使うコマンドを表示するだけ
//     --no-rebuild   Lambda にページの作り直しを頼まない
//     --update-code  Lambda のプログラム（zip）も更新する

import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    bucket: { type: 'string', default: process.env.S3_BUCKET ?? process.env.SITE_BUCKET },
    'data-bucket': { type: 'string', default: process.env.DATA_BUCKET },
    distribution: { type: 'string', default: process.env.CLOUDFRONT_DISTRIBUTION_ID },
    function: { type: 'string', default: process.env.LAMBDA_FUNCTION },
    locale: { type: 'string', default: process.env.LOCALE ?? 'ja' },
    dryrun: { type: 'boolean', default: false },
    print: { type: 'boolean', default: false },
    'no-rebuild': { type: 'boolean', default: false },
    'update-code': { type: 'boolean', default: false },
  },
});
if (!values.bucket) throw new Error('公開用バケットを --bucket か環境変数 S3_BUCKET で指定してください');
if (!values['data-bucket']) throw new Error('データ用バケットを --data-bucket か環境変数 DATA_BUCKET で指定してください');

const locale = values.locale;
const data = `s3://${values['data-bucket']}`;
const site = `s3://${values.bucket}`;
const dry = values.dryrun ? ['--dryrun'] : [];
const IMAGE_CACHE = 'public, max-age=604800';
const JSON_TYPE = 'application/json; charset=utf-8';
const images = path.join(ROOT, 'data/images');

const steps = [
  ['aws', ['s3', 'sync', path.join(ROOT, 'data/words', locale), `${data}/words/${locale}`,
    '--delete', '--exclude', '*', '--include', '*.json', '--content-type', JSON_TYPE, ...dry]],
  ['aws', ['s3', 'cp', path.join(ROOT, 'data/site', `${locale}.json`), `${data}/site/${locale}.json`,
    '--content-type', JSON_TYPE, ...dry]],
  ['aws', ['s3', 'cp', path.join(ROOT, 'data/schedule', `${locale}.json`), `${data}/schedule/${locale}.json`,
    '--content-type', JSON_TYPE, ...dry]],
  ['aws', ['s3', 'sync', images, `${site}/images`, '--delete',
    '--exclude', '*', '--include', '*.webp', '--content-type', 'image/webp', '--cache-control', IMAGE_CACHE, ...dry]],
  ['aws', ['s3', 'sync', images, `${site}/images`, '--delete',
    '--exclude', '*', '--include', '*.svg', '--content-type', 'image/svg+xml', '--cache-control', IMAGE_CACHE, ...dry]],
];

function run(cmd, args) {
  console.error(`$ ${cmd} ${args.map((a) => (/[\s*]/.test(a) ? `'${a}'` : a)).join(' ')}`);
  if (values.print) return { status: 0, stdout: '', stderr: '' };
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error?.code === 'ENOENT') throw new Error(`${cmd} が見つかりません（AWS CLI を入れてください）`);
  return result;
}

for (const [cmd, args] of steps) {
  const result = run(cmd, args);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// リポジトリのパズルは、データ用バケットに無いキーだけ足す。すでにあるものは上書きしない。
const puzzleDir = path.join(ROOT, 'puzzles');
for (const file of (await readdir(puzzleDir)).filter((f) => f.endsWith('.json'))) {
  const key = `puzzles/${locale}/${file}`;
  if (values.print || values.dryrun) {
    console.error(`# ${key} が無ければ ${path.join(puzzleDir, file)} を置く（上書きしない）`);
    continue;
  }
  const head = spawnSync('aws', ['s3api', 'head-object', '--bucket', values['data-bucket'], '--key', key], { encoding: 'utf8' });
  if (head.status === 0) {
    console.error(`# そのまま: ${key}`);
    continue;
  }
  if (!/Not Found|404/.test(`${head.stderr}`)) {
    process.stderr.write(head.stderr ?? '');
    process.exit(head.status ?? 1);
  }
  const put = run('aws', ['s3', 'cp', path.join(puzzleDir, file), `${data}/${key}`, '--content-type', JSON_TYPE]);
  if (put.status !== 0) process.exit(put.status ?? 1);
}

if (values['update-code'] && !values.print && !values.dryrun) {
  if (!values.function) throw new Error('Lambda の関数名を --function か環境変数 LAMBDA_FUNCTION で指定してください');
  const zip = path.join(mkdtempSync(path.join(tmpdir(), 'xword-lambda-')), 'function.zip');
  const packed = run('zip', ['-qr', zip, 'package.json', 'generator', 'template', 'lambda', '-x', '*.DS_Store']);
  if (packed.status !== 0) process.exit(packed.status ?? 1);
  const updated = run('aws', ['lambda', 'update-function-code', '--function-name', values.function, '--zip-file', `fileb://${zip}`]);
  if (updated.status !== 0) process.exit(updated.status ?? 1);
}

if (!values['no-rebuild'] && values.function && !values.dryrun) {
  const out = path.join(tmpdir(), 'xword-rebuild.json');
  const invoked = run('aws', ['lambda', 'invoke', '--function-name', values.function,
    '--cli-binary-format', 'raw-in-base64-out', '--cli-read-timeout', '120',
    '--payload', '{"rebuild":true}', out]);
  if (invoked.status !== 0) process.exit(invoked.status ?? 1);
  if (!values.print) console.error(`# Lambda の戻り値: ${out}`);
} else if (!values.function) {
  console.error('Lambda の関数名がないので、ページは作り直していません（--function）');
}
