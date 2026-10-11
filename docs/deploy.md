# 本番に上げる（S3 + CloudFront）

本番のサイトは AWS の S3 に置き、CloudFront を通して `https://xword.engawa5656.com/` で公開します。
GitHub はプログラムと単語リストの置き場所で、GitHub Pages での公開はしません。

---

## 1. ふだんの流れ

```
1. 作業ブランチで単語リストを作る・直す        docs/genre-guide.md の手順どおり
2. 点検・動作確認                            npm run check-theme -- --theme <ジャンル> --strict
                                            npm test
                                            npm run site（site/*.html をブラウザで開いて確かめる）
3. main に入れる                             持ち主が確認してから
4. 本番に上げる                              main の内容で npm run deploy
```

```
S3_BUCKET=<バケット名> CLOUDFRONT_DISTRIBUTION_ID=<ディストリビューション ID> npm run deploy
```

`npm run deploy` がすること:

1. `site/` を作り直す（`npm run site` と同じ）
2. 絵（`site/images/`）を S3 に同期する。キャッシュは 1 週間（`Cache-Control: public, max-age=604800`）。WebP は種類（`image/webp`）を明示する
3. ページ・JSON・`sitemap.xml` を S3 に同期する。キャッシュは 5 分（`public, max-age=300`）。
   `robots.txt`・`llms.txt` は日本語が化けないように `text/plain; charset=utf-8` を明示する
4. 手元にないファイルは S3 からも消す（`--delete`）
5. CloudFront のキャッシュを消す（`/*` の invalidation）

| オプション | 内容 |
|---|---|
| `--dryrun` | 何が送られ、何が消えるかを表示するだけ（S3 は変わらない）。**最初は必ずこれで確かめる** |
| `--print` | 使うコマンドを表示するだけ |
| `--no-build` | `site/` を作り直さない |
| `--bucket` / `--distribution` | 環境変数の代わりに指定する |

- AWS CLI（`aws`）が必要です。認証は AWS CLI のふつうの方法（`AWS_PROFILE`、SSO、環境変数など）で行います。
- 作ったページ（`site/`）はリポジトリに入れています。`main` の `site/` をそのまま S3 に置くこともできます（S3 の画面からアップロードするなど）。
  その場合も、WebP の種類（`image/webp`）と、キャッシュの設定に気をつけてください。
- 単語リストやパズルを変えたら、`npm run site` で `site/` を作り直してからコミットします。

---

## 2. AWS の準備（最初に 1 回）

### 2.1 S3 バケット

- 名前の例: `xword-engawa5656-com`（リージョンはどこでもよい。例: 東京 `ap-northeast-1`）
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
      "Resource": "arn:aws:s3:::<バケット名>"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<バケット名>/*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::<アカウント ID>:distribution/<ディストリビューション ID>"
    }
  ]
}
```

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
