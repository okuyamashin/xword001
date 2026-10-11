// 用意しておいたカギを使う（手で書いたカギ、他の手段で作ったカギなど）
// drafts: [{ answer, display, clue }]

export function createFileWriter(drafts) {
  const byKey = new Map(drafts.map((d) => [`${d.answer}|${d.display}`, d.clue]));
  return {
    name: 'file',
    async write({ words }) {
      return words.map((w) => ({ answer: w.answer, display: w.display, clue: byKey.get(`${w.answer}|${w.display}`) ?? '' }));
    },
  };
}
