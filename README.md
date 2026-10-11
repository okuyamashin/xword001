# xword001

多言語対応クロスワードパズルの自動生成サイト（1日1問の静的サイト）。最初は日本語版。

設計: [docs/design.md](docs/design.md)

## 使い方（Node.js 20 以上）

```
npm run make -- --theme countries                      # puzzles/00004-countries-002.json のように次の番号で作る
npm run trial -- --theme countries --days 30           # 何日分か組んで集計する
npm run texts -- --puzzle puzzles/00001-countries-001.json   # カギと解説をつける（OpenAI。要 OPENAI_API_KEY）
npm run site                                           # site/ に HTML を作る
npm test
```
