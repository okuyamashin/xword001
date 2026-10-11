// 用意しておいた文章を使う（手で書いたもの、他の手段で作ったものなど）
// drafts: [{ answer, display, clue?, explanation? }]
//   または { words: [...], intro: { description } }

export function createFileWriter(drafts) {
  const list = Array.isArray(drafts) ? drafts : (drafts.words ?? []);
  const byKey = new Map(list.map((d) => [`${d.answer}|${d.display}`, d]));
  return {
    name: 'file',
    async generate() {
      if (!drafts.intro) throw new Error('drafts に intro がない');
      return drafts.intro;
    },
    async write({ field, words }) {
      return words.map((w) => ({ answer: w.answer, display: w.display, text: byKey.get(`${w.answer}|${w.display}`)?.[field] ?? '' }));
    },
  };
}
