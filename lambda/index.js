// Lambda の入口。毎日 EventBridge Scheduler から呼ばれ、パズルを 1 問作ってページを作り直す。
// ハンドラー: lambda/index.handler（ランタイム Node.js 20 以上。AWS SDK v3 はランタイムに入っているものを使う）
//
// 環境変数:
//   DATA_BUCKET                  データ（単語リスト・予定表・パズル）を置く非公開のバケット
//   SITE_BUCKET                  公開用のバケット（CloudFront のオリジン）
//   CLOUDFRONT_DISTRIBUTION_ID   キャッシュを消す CloudFront（なければ消さない）
//   LOCALE                       ja（省略時）
//
// イベント（すべて省略できる）:
//   { "genre": "sangetsuki" }        ジャンルを指定して作る（同じ日に何問でも作れる）
//   { "date": "2026-10-12" }         作った日（省略時はサイトのタイムゾーンで今日）
//   { "force": true }                ジャンルを指定しないときでも、その日の問題がすでにあっても作る
//   { "dryRun": true }               作るだけで、保存も公開もしない（盤面を返す）
// ジャンルを指定しないときは、予定表のその日のジャンル、なければランダム。
// その日の問題がすでにあれば何もしない（スケジューラーの再実行で 2 問できないように）。

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { runDaily } from '../generator/daily.js';
import { loadSiteSources } from '../generator/lib/site-sources.js';

const s3 = new S3Client({});
const cloudfront = new CloudFrontClient({});

function bucketStore(bucket) {
  return {
    async list(prefix) {
      const keys = [];
      let token;
      do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of res.Contents ?? []) keys.push(o.Key);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    async get(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return await res.Body.transformToString('utf-8');
      } catch (e) {
        if (e.name === 'NoSuchKey') return null;
        throw e;
      }
    },
    async put(key, body, { contentType, cacheControl, ifNoneMatch } = {}) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body,
        ContentType: contentType ?? 'application/json; charset=utf-8',
        CacheControl: cacheControl,
        IfNoneMatch: ifNoneMatch ? '*' : undefined,
      }));
    },
  };
}

export async function handler(event = {}) {
  const { DATA_BUCKET, SITE_BUCKET, CLOUDFRONT_DISTRIBUTION_ID, LOCALE = 'ja' } = process.env;
  if (!DATA_BUCKET || !SITE_BUCKET) throw new Error('環境変数 DATA_BUCKET と SITE_BUCKET が必要です');
  const store = {
    data: bucketStore(DATA_BUCKET),
    site: bucketStore(SITE_BUCKET),
    async invalidate(paths) {
      if (!CLOUDFRONT_DISTRIBUTION_ID) return;
      await cloudfront.send(new CreateInvalidationCommand({
        DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch: { CallerReference: `xword-${Date.now()}`, Paths: { Quantity: paths.length, Items: paths } },
      }));
    },
  };
  const locale = await import(`../generator/locales/${LOCALE}.js`);
  const result = await runDaily({
    store,
    sources: await loadSiteSources(LOCALE),
    locale,
    date: event.date,
    genre: event.genre,
    force: Boolean(event.force),
    dryRun: Boolean(event.dryRun),
  });
  console.log(JSON.stringify(result));
  return result;
}
