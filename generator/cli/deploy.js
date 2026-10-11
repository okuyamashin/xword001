// 本番（S3 + CloudFront）に上げる。site/ を作り直してから S3 に同期し、CloudFront のキャッシュを消す。
// AWS CLI（aws）を使う。認証は AWS CLI のふつうの方法（AWS_PROFILE、環境変数、SSO など）。
//
// 使い方:
//   S3_BUCKET=<バケット名> CLOUDFRONT_DISTRIBUTION_ID=<ID> npm run deploy
//   npm run deploy -- --bucket <バケット名> [--distribution <ID>] [--dryrun] [--print] [--no-build]
//     --dryrun    aws s3 sync を --dryrun で動かす（何が送られ、何が消えるかを表示するだけ）
//     --print     実行せず、使うコマンドを表示するだけ
//     --no-build  site/ を作り直さない

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../lib/words.js';

const { values } = parseArgs({
  options: {
    bucket: { type: 'string', default: process.env.S3_BUCKET },
    distribution: { type: 'string', default: process.env.CLOUDFRONT_DISTRIBUTION_ID },
    dryrun: { type: 'boolean', default: false },
    print: { type: 'boolean', default: false },
    'no-build': { type: 'boolean', default: false },
  },
});
if (!values.bucket) throw new Error('バケット名を --bucket か環境変数 S3_BUCKET で指定してください');

const site = path.join(ROOT, 'site');
const target = `s3://${values.bucket}`;
const dry = values.dryrun ? ['--dryrun'] : [];

// キャッシュの長さ: 絵は 1 週間（同じ名前で作り直すことがあるので immutable にはしない）、ページと JSON は 5 分
const IMAGE_CACHE = 'public, max-age=604800';
const PAGE_CACHE = 'public, max-age=300';

const steps = [];
if (!values['no-build']) steps.push(['node', [path.join(ROOT, 'generator/cli/build-site.js')]]);
steps.push(
  // 絵（WebP は種類を明示する。古い AWS CLI は .webp の種類を知らないことがある）
  ['aws', ['s3', 'sync', `${site}/images`, `${target}/images`, '--delete', '--exclude', '*', '--include', '*.webp',
    '--content-type', 'image/webp', '--cache-control', IMAGE_CACHE, ...dry]],
  ['aws', ['s3', 'sync', `${site}/images`, `${target}/images`, '--delete', '--exclude', '*.webp',
    '--cache-control', IMAGE_CACHE, ...dry]],
  // ページ・JSON・sitemap.xml。消えたファイルは S3 からも消す
  ['aws', ['s3', 'sync', site, target, '--delete', '--exclude', 'images/*', '--exclude', '*.txt', '--cache-control', PAGE_CACHE, ...dry]],
  // robots.txt・llms.txt（日本語が化けないように文字コードを明示する）
  ['aws', ['s3', 'sync', site, target, '--delete', '--exclude', '*', '--include', '*.txt',
    '--content-type', 'text/plain; charset=utf-8', '--cache-control', PAGE_CACHE, ...dry]],
);
if (values.distribution && !values.dryrun) {
  steps.push(['aws', ['cloudfront', 'create-invalidation', '--distribution-id', values.distribution, '--paths', '/*']]);
}

for (const [cmd, args] of steps) {
  console.error(`$ ${cmd} ${args.map((a) => (/[\s*]/.test(a) ? `'${a}'` : a)).join(' ')}`);
  if (values.print) continue;
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') throw new Error(`${cmd} が見つかりません（AWS CLI を入れてください）`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!values.distribution) console.error('CloudFront の ID がないので、キャッシュは消していません（CLOUDFRONT_DISTRIBUTION_ID）');
