// クロスワード（JSON）から HTML 1枚を作る。ファイル操作はしない。

// locales/<locale>.js のソースを、ブラウザでそのまま動く形にする
export function inlineLocale(source) {
  return source.replace(/^export /gm, '');
}

export function renderPuzzleHtml({ template, puzzle, localeSource }) {
  const json = JSON.stringify(puzzle).replace(/</g, '\\u003c');
  return template
    .replace('__TITLE__', `クロスワード ${puzzle.date}｜${escapeHtml(puzzle.title)}`)
    .replace('/*__LOCALE__*/', () => inlineLocale(localeSource))
    .replace('/*__PUZZLE__*/null', () => json);
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
