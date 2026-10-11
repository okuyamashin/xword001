# xword001

多言語対応クロスワードパズルの自動生成サイト（1日1問の静的サイト）。最初は日本語版。

設計: [docs/design.md](docs/design.md)

## 使い方（Node.js 20 以上）

```
npm run make -- --date 2026-10-12 --theme countries   # puzzles/2026-10-12-ja.json を作る
npm run trial -- --theme countries --days 30           # 何日分か組んで集計する
npm run clues -- --puzzle puzzles/2026-10-12-ja.json   # カギをつける（要 ANTHROPIC_API_KEY）
npm run site                                           # site/ に HTML を作る
npm test
```
