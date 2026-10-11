# xword001

「よろずのクロスワードパズル」: テーマ（ジャンル）ごとのクロスワードパズルを自動で作る静的サイト。最初は日本語版。

- ジャンルの作り方: [docs/genre-guide.md](docs/genre-guide.md)
- 設計: [docs/design.md](docs/design.md)
- 本番に上げる（S3 + CloudFront）: [docs/deploy.md](docs/deploy.md)

## 使い方（Node.js 20 以上）

```
npm run theme-image -- --theme sangetsuki             # ジャンルの絵を作る（OpenAI）
npm run theme-texts -- --theme sangetsuki             # 各語のカギと解説を作り置きする（OpenAI）
npm run check-theme -- --theme sangetsuki --strict    # 単語リストを点検する
npm run make -- --theme countries                      # puzzles/00004-countries-002.json のように次の番号で作る
npm run trial -- --theme countries --days 30           # 何日分か組んで集計する
npm run texts -- --puzzle puzzles/00001-countries-001.json   # 作り置きのない語だけ、その場でカギと解説をつける（予備）
npm run site                                           # site/ に HTML を作る
npm run deploy                                         # 本番（S3）に上げる（要 AWS CLI・S3_BUCKET）
npm test
```
