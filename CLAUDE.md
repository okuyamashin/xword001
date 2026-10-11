# xword001（よろずのクロスワードパズル）

テーマ（ジャンル）ごとのクロスワードパズルを作る静的サイト。日本語版から。
本番: `https://xword.engawa5656.com/`（S3 + CloudFront）。`main` の内容で `npm run deploy` を実行して上げる（`docs/deploy.md`）。GitHub Pages では公開しない。

## 読むもの

- **ジャンルを作る・直すとき: `docs/genre-guide.md` に必ず従う**（命名・ファイル形式・文字のルール・カギと解説の書き方・絵・点検・公開の全手順）
- 仕組みの詳しい説明: `docs/design.md`
- 本番に上げる手順と AWS の準備: `docs/deploy.md`

## 大事な決まり

- 作るのは単語リスト（`data/words/ja/<ジャンル>.json`）とジャンルの絵だけ。パズルは単語リストから AI なしで作る。
- カギと解説は単語リストに 1 語 1 つずつ作り置きする。**Claude Code は API キーなしで直接書いてよい**（`docs/genre-guide.md` 2.6〜2.8 のルールどおりに）。
- OpenAI の API キーが要るのは絵（`npm run theme-image`）と、AI に文章を書かせるとき（`npm run theme-texts`）だけ。
- 答えの文字種はジャンルごとに `kana`（カタカナ）か `latin`（英字の大文字）。文字のルールは `generator/scripts/`。
- パズルの ID は `<通し番号5桁>-<ジャンル>-<ジャンル内連番3桁>`（例: `00003-sangetsuki-001`）。ジャンルの英名は小文字・数字・アンダースコア。
- 絵の PNG はリポジトリに入れない（WebP に変える）。
- 作ったページ（`site/`）はリポジトリに入れない（`.gitignore`）。`npm run site` で作って確かめ、本番へは `npm run deploy` が作り直して S3 に上げる。
- 本番に上げる（`npm run deploy`）のは、持ち主の指示があるときだけ。
- 事実の誤りに気をつける。AI の書いた文章は必ず読み直す。
- ドキュメントは日本語。手順やルールを変えたら `docs/genre-guide.md` と `docs/design.md` も直す。

## コマンド（Node.js 20 以上）

```
npm test                                         # テスト
npm run check-theme -- --theme <ジャンル> --strict  # 単語リストの点検
npm run trial -- --theme <ジャンル> --days 20       # 盤面の組みやすさ
npm run make -- --theme <ジャンル>                  # パズルを作る
npm run site                                     # site/ を作る
npm run deploy -- --dryrun                       # 本番（S3）に上げる前の確認（要 AWS CLI と S3_BUCKET）
npm run theme-image -- --theme <ジャンル>           # ジャンルの絵（OpenAI）
npm run theme-texts -- --theme <ジャンル>           # カギと解説を AI に書かせる（OpenAI）
```

クラウド環境で OpenAI を使うコマンドは `NODE_USE_ENV_PROXY=1` が必要（npm スクリプトに入っている）。

## 確認のしかた

- 画面を変えたら、Playwright（Chromium）でページを開いて操作を確かめる。スマホの幅（375〜390px）でも見る。
- `npm run site` で作った `site/*.html` は `file://` で開ける。
