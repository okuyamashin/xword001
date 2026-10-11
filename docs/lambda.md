# 毎日の問題づくり（Lambda）と S3 の分け方

ここに書くのは、パズルを Lambda で作るようにするための**方針と仕様**です。
Lambda の中身と `npm run deploy` はリポジトリにあります（「4. できているもの」）。
AWS の名前は、公開用バケット `xword-engawa5656`、データ用バケット `xword-data-engawa5656`、関数 `xword-daily`、CloudFront `EPMSPX74FLDVH` です。

---

## 1. 方針

- **GitHub から上げるのは、単語リスト・ジャンルの絵・サイトの設定・予定表・プログラムだけ。**
  パズルは GitHub を通らず、**Lambda が作って S3 に置く**。
- **問題の一覧の本体は S3（データ用バケット）。** リポジトリの `puzzles/` は、最初の 4 問と、手元で試すためのもの。
  以後、リポジトリにパズルを足さない（`npm run make` は手元で試す用）。
- **バケットは 2 つに分ける。**

| バケット | 公開 | 中身 |
|---|---|---|
| 公開用（今のバケット） | CloudFront から見える | ページ（HTML・JSON・sitemap.xml など）と絵（`images/`） |
| データ用（新しく作る） | **非公開**（Lambda と deploy だけが読み書きする） | 単語リスト（作る側のメモ `note` が入るので公開しない）、サイトの設定、予定表、パズルの元データ |

- 同じバケットの中に非公開の場所を作ることもできるが、CloudFront の設定が増えるので分ける。

### 1.1 データ用バケットの中身

```
site/ja.json                 サイトの設定（data/site/ja.json）
words/ja/<ジャンル>.json      単語リスト（data/words/ja/）
schedule/ja.json             予定表（data/schedule/ja.json）
puzzles/ja/<ID>.json         作ったパズル（例: puzzles/ja/00005-sangetsuki-002.json）。Lambda が足していく
```

- 上の 3 つ（site・words・schedule）は GitHub が元。`npm run deploy` で上げる（データ用バケット側で直接直さない）。
- `puzzles/` は S3 が元。Lambda だけが足す。消さない。
- データ用バケットはバージョニングを有効にしておくと、間違えて消したときに戻せる。

---

## 2. ジャンルの決め方

Lambda を呼ぶときのイベントで決まる。

1. **イベントでジャンルを指定したとき**（`{"genre": "sangetsuki"}`）: そのジャンルで作る。同じ日に何問でも作れる。
2. **指定がないとき（毎日の自動）**: 予定表（`schedule/ja.json`）のその日のジャンル。
3. **予定表にその日がないとき**: ランダム。
   - 選ぶのは、つなぎの言葉ではなく、**カギのある言葉が 30 語以上**あるジャンル
   - 直前の回と同じジャンルは避ける（ほかに選べるものがあれば）
- 自動のとき、**その日の問題がすでにあれば何もしない**（スケジューラーが 2 回動いても 2 問できないように）。`{"force": true}` で作る。

### 2.1 予定表（`data/schedule/ja.json`）

```json
{
  "days": {
    "2026-10-12": "animals",
    "2026-10-13": "sangetsuki"
  }
}
```

- 日付はサイトのタイムゾーン（`data/site/ja.json` の `timeZone`、`Asia/Tokyo`）での日付。
- 値はジャンル（テーマ ID）。リポジトリで直して、`npm run deploy` でデータ用バケットに上げる。

### 2.2 使う言葉

- Lambda は**カギのある言葉だけ**を使う（カギのない言葉が盤面に入らないように）。つなぎの言葉も同じ。
- 解説はなくても作れる（正解したときに解説が出ないだけ）。ジャンルを公開する前に、カギと解説をそろえておく（`docs/genre-guide.md`）。

---

## 3. Lambda の仕様

| 項目 | 値 |
|---|---|
| ランタイム | Node.js 20 以上（AWS SDK v3 はランタイムに入っているものを使う。zip に入れなくてよい） |
| ハンドラー | `lambda/index.handler` |
| zip に入れるもの | `package.json`・`generator/`・`template/`・`lambda/`（`node_modules` は要らない） |
| メモリ・時間 | 512MB・60 秒くらい（盤面とページづくりは 1 秒かからない。あとは S3 の読み書き） |
| 同時実行 | 1 に絞る（予約済み同時実行数 1）。通し番号がぶつからないように |
| スケジュール | EventBridge Scheduler で毎日 0 時（タイムゾーン `Asia/Tokyo`）。設定は持ち主が上げるときにする。イベントは `{}` |

環境変数:

| 名前 | 内容 |
|---|---|
| `DATA_BUCKET` | データ用バケット |
| `SITE_BUCKET` | 公開用バケット |
| `CLOUDFRONT_DISTRIBUTION_ID` | キャッシュを消す CloudFront（なければ消さない） |
| `LOCALE` | `ja`（省略時） |

イベント（すべて省略できる）:

| イベント | 内容 |
|---|---|
| `{}` | 毎日の自動。予定表 → ランダム。その日の問題があれば何もしない |
| `{"genre": "sangetsuki"}` | ジャンルを指定して作る |
| `{"date": "2026-10-12"}` | 作った日（省略時はタイムゾーンで今日） |
| `{"force": true}` | 自動でも、その日の問題があっても作る |
| `{"dryRun": true}` | 作るだけで、保存も公開もしない（盤面を返す。試すとき用） |
| `{"rebuild": true}` | 新しい問題は作らず、今あるパズルでページだけ作り直す |

手で 1 問作る例:

```
aws lambda invoke --function-name <関数名> --cli-binary-format raw-in-base64-out \
  --payload '{"genre":"sangetsuki"}' out.json && cat out.json
```

Lambda がすること:

1. データ用バケットから、サイトの設定・単語リスト・予定表・今までのパズルを読む
2. ジャンルを決め（2.）、次の通し番号とジャンル内の連番でパズルを作る
3. パズルを `puzzles/ja/<ID>.json` に保存する。**同じキーがすでにあれば失敗する**（S3 の条件付き書き込み `If-None-Match: *`）
4. 公開用バケットの `images/` の一覧を読み（絵があるかどうか）、ページをすべて作り直して公開用バケットに置く
   （HTML・JSON・sitemap.xml・robots.txt・llms.txt など。`Cache-Control: public, max-age=300`、文字コード UTF-8）
5. CloudFront のキャッシュを消す（`/*`）
6. 結果（ID・ジャンル・決め方 event / schedule / random・盤面の情報）を返し、ログにも出す

### 3.1 Lambda の権限（実行ロール）

- データ用バケット: `s3:ListBucket`、`s3:GetObject`、`s3:PutObject`（`puzzles/*` だけでよい）
- 公開用バケット: `s3:ListBucket`、`s3:PutObject`（`images/*` は読むだけなので List だけでよい）
- `cloudfront:CreateInvalidation`（そのディストリビューション）
- CloudWatch Logs（`AWSLambdaBasicExecutionRole`）

---

## 4. できているもの（リポジトリ）

| ファイル | 内容 |
|---|---|
| `lambda/index.js` | Lambda の入口。S3 と CloudFront を AWS SDK v3 で読み書きする |
| `generator/daily.js` | 中身（`runDaily`）。ジャンル選び・パズルづくり・保存・ページの作り直し。S3 には直接さわらず、入れ物（store）を通す |
| `generator/site-build.js` | ページをまとめて作る（`buildSitePages`）。ファイル操作をしない。`npm run site` と Lambda の両方が使う |
| `generator/lib/site-sources.js` | テンプレートとページに埋め込むプログラムを読む |
| `test/daily.test.js` | S3 の代わりにメモリ上の入れ物で、指定・予定表・ランダム・同じ日の 2 回目・dryRun を確かめる |
| `data/schedule/ja.json` | 予定表（いまは空） |

`@aws-sdk/client-s3` と `@aws-sdk/client-cloudfront` は、手元で `lambda/index.js` を試すために devDependencies に入れてある（zip には入れない）。

---

## 5. `npm run deploy` と AWS

手元でパズルを落としてページを作り、公開バケットへ `--delete` で同期する手順は使いません。
落としたあとに Lambda が 1 問足すと、トップとサイトマップがその 1 問を欠いたまま上書きされ、HTML だけ残る、というずれが起きるためです。
ページの作り直しは Lambda の `{"rebuild":true}` に任せます。パズルが 1 問もなければ Lambda は止め、空のサイトでは上書きしません。

### 5.1 `npm run deploy`

1. 単語リスト・サイトの設定・予定表をデータ用バケットに上げる（単語リストの prefix だけ `--delete` してよい）
2. 絵を公開用バケットの `images/` に上げる
3. リポジトリの `puzzles/*.json` は、データ用バケットに同じキーが無いときだけ足す（上書きしない）
4. Lambda に `{"rebuild":true}` を渡す。データ用バケットのパズルを読んで公開ページを作り直し、CloudFront のキャッシュを消す
5. `--update-code` のときだけ、プログラムの zip で Lambda を更新する

単語リストを直したあとの `npm run deploy` で、単語帳のページは新しくなります。すでに作ったパズルのページのカギと解説は、作ったときの JSON のままです。

### 5.2 AWS（作ってあるもの）

- データ用バケット `xword-data-engawa5656`（非公開、バージョニング有効）
- Lambda 関数 `xword-daily`（Node.js 22、512MB、60 秒、予約済み同時実行数 1）と実行ロール `xword-daily-role`
- EventBridge Scheduler `xword-daily`（毎日 0 時 `Asia/Tokyo`、イベント `{}`、有効）
- `npm run deploy` を動かす人の権限に、データ用バケットの読み書きと `lambda:UpdateFunctionCode`・`lambda:InvokeFunction` を足す

### 5.3 最初の切り替えの順番

1. データ用バケットを作る
2. `--no-rebuild` で単語リスト・絵・今の 4 問を上げる
3. Lambda を作り、`{"dryRun": true}` で試す
4. `{"rebuild": true}` で、今の問題のページを作り直して確かめる
5. スケジュールを有効にする（有効にしたその夜の 0 時から、1 日 1 問作る）
