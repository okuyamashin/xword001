// 用意しておいた文章を使う（手で書いたもの、他の手段で作ったものなど）
// drafts: [{ answer, display, clue?, explanation? }]

export function createFileWriter(drafts) {
  const byKey = new Map(drafts.map((d) => [`${d.answer}|${d.display}`, d]));
  return {
    name: 'file',
    async write({ field, words }) {
      return words.map((w) => ({ answer: w.answer, display: w.display, text: byKey.get(`${w.answer}|${w.display}`)?.[field] ?? '' }));
    },
  };
}
