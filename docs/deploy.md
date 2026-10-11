# 本番に上げる（S3 + CloudFront）

本番のサイトは AWS の S3 に置き、CloudFront を通して `https://xword.engawa5656.com/` で公開します。
GitHub はプログラムと単語リストの置き場所で、GitHub Pages での公開はしません。

パズルは Lambda が毎日作って S3 に置きます（`docs/lambda.md`）。
`npm run deploy` が上げるのは、ジャンルの単語リストと絵です。Lambda が読むサイトの設定と予定表も一緒に上げます。
公開ページとパズルの JSON は Lambda が書きます。手元の `puzzles/` で公開バケットを `--delete` 同期すると、Lambda が作った問題が消えるので、その同期はしません。

---

## 1. ふだんの流れ

```
1. 作業ブランチで単語リストや絵を作る・直す    docs/genre-guide.md の手順どおり
2. 点検・動作確認                            npm run check-theme -- --theme <ジャンル> --strict
                                            npm test
                                            npm run site（site/*.html をブラウザで開いて確かめる。これは手元だけ）
3. main に入れる                             持ち主が確認してから
4. 本番に上げる                              main の内容で npm run deploy
```

```
npm run deploy -- --bucket xword-engawa5656 --data-bucket xword-data-engawa5656 --distribution EPMSPX74FLDVH --function xword-daily
```

`npm run deploy` がすること:

1. 単語リストをデータ用バケットの `words/ja/` に同期する（無くなったジャンルのファイルはそこから消す）
2. サイトの設定と予定表をデータ用バケットの `site/ja.json`・`schedule/ja.json` に置く
3. 絵（WebP・SVG）を公開用バケットの `images/` に同期する。キャッシュは 1 週間。WebP は `image/webp`
4. リポジトリの `puzzles/*.json` を、データ用バケットに同じキーが無いときだけ足す（上書きしない。最初の 4 問用）
5. Lambda に `{"rebuild":true}` を渡す。Lambda がデータ用バケットのパズルを読んで、公開ページ・サイトマップを作り直し、CloudFront のキャッシュを消す

| オプション | 内容 |
|---|---|
| `--dryrun` | 何が送られるかを表示するだけ（S3 は変わらない）。**最初は必ずこれで確かめる** |
| `--print` | 使うコマンドを表示するだけ |
| `--no-rebuild` | Lambda にページの作り直しを頼まない |
| `--update-code` | Lambda のプログラム（zip）も更新する |
| `--bucket` / `--data-bucket` / `--distribution` / `--function` | 環境変数の代わりに指定する |

- AWS CLI（`aws`）が必要です。認証は AWS CLI のふつうの方法（`AWS_PROFILE`、SSO、環境変数など）で行います。
- 作ったページ（`site/`）はリポジトリに入れません（`.gitignore`）。本番のページは S3 にだけあり、作り直すのは Lambda です。
- すぐに 1 問作りたいときは、Lambda を `{"genre":"<ジャンル>"}` で呼びます。`npm run deploy` は問題を作りません。

---

## 2. AWS の準備（最初に 1 回）

### 2.1 S3 バケット

- 公開用は `xword-engawa5656`、データ用（非公開）は `xword-data-engawa5656`。リージョンは東京 `ap-northeast-1`。
- **パブリックアクセスはすべてブロック**したままにする（公開は CloudFront から）。
- 静的ウェブサイトホスティングは使わない。

### 2.2 証明書（ACM）

- **バージニア北部（`us-east-1`）**で、`xword.engawa5656.com` の証明書をリクエストする（CloudFront 用の証明書はこのリージョンのみ）。
- DNS 検証の CNAME を、`engawa5656.com` の DNS に追加する。

### 2.3 CloudFront

| 設定 | 値 |
|---|---|
| オリジン | 2.1 の S3 バケット（REST エンドポイント）。**オリジンアクセスコントロール（OAC）**を作って使う |
| 代替ドメイン名（CNAME） | `xword.engawa5656.com` |
| SSL 証明書 | 2.2 の証明書 |
| ビューワープロトコル | HTTP を HTTPS にリダイレクト |
| デフォルトルートオブジェクト | `index.html` |
| キャッシュポリシー | `CachingOptimized`（オリジンの `Cache-Control` に従う） |
| 圧縮 | 有効 |

OAC を作ると、S3 のバケットポリシーの例が表示されるので、それをバケットに設定する（CloudFront からだけ読めるようにする）。

### 2.4 DNS

`engawa5656.com` の DNS に、`xword` → CloudFront のドメイン名（`dxxxxxxxx.cloudfront.net`）を追加する。

- Route 53 なら A / AAAA の**エイリアス**
- ほかの DNS なら **CNAME**

### 2.5 本番に上げる人の権限（IAM）

`npm run deploy` に必要な最小の権限:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::xword-engawa5656",
        "arn:aws:s3:::xword-data-engawa5656"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::xword-engawa5656/*",
        "arn:aws:s3:::xword-data-engawa5656/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction", "lambda:UpdateFunctionCode", "lambda:GetFunction"],
      "Resource": "arn:aws:lambda:ap-northeast-1:868118155022:function:xword-daily"
    }
  ]
}
```

ページのキャッシュを消すのは Lambda です（`cloudfront:CreateInvalidation` は Lambda の実行ロールに付けます）。

---

## 3. 確かめること（本番に上げたあと）

- [ ] `https://xword.engawa5656.com/` で最新の問題が開く
- [ ] 表紙の絵が出て消える（WebP が `image/webp` で届いている）
- [ ] バックナンバー・単語帳・各問題のページへのリンクが動く
- [ ] スマホで開いて、入力・答え合わせ・完成ができる
- [ ] `https://xword.engawa5656.com/robots.txt`・`/sitemap.xml`・`/llms.txt` が開く（llms.txt の日本語が化けていない）

### 3.1 検索エンジンへの登録（最初に 1 回）

- [Google Search Console](https://search.google.com/search-console) でサイト（`https://xword.engawa5656.com/` のドメインか URL プレフィックス）を登録し、所有者の確認をする（DNS の TXT レコードが簡単）。
  「サイトマップ」に `sitemap.xml` を送る。
- Bing なら [Bing Webmaster Tools](https://www.bing.com/webmasters)（Search Console から読み込める）。
- そのあとは、`npm run deploy` のたびに `sitemap.xml` が新しくなるので、送り直す必要はない。

---

## 4. 注意

- **アドレスは変えない。** 解いた記録（完成・途中）はブラウザにアドレスごとに保存されるので、変えると利用者の記録が引き継がれない。
- 以前のテスト用の公開先（`okuyamashin.github.io/xword001`）は使わない。GitHub の Settings → Pages で公開を止める。
