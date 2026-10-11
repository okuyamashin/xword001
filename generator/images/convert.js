// 絵（PNG・JPEG）を、表示の大きさに合わせた WebP に変える
//   <名前>.webp        表紙用。800px 四方（盤面の最大幅 520px に対し、高精細画面でもほぼ足りる大きさ。表示は 1.2 秒ほどなので軽さを優先）
//   <名前>.thumb.webp  一覧ページの小さな絵用。88px の 2 倍 = 176px 四方
// GitHub に大きなファイルを入れないよう、元の PNG・JPEG はリポジトリに入れない。

import sharp from 'sharp';

export const COVER_SIZE = 800;
export const THUMB_SIZE = 176;

// input: ファイルのパスまたは Buffer。outBase: 拡張子を除いた出力先（例: data/images/sangetsuki）
export async function convertImage(input, outBase) {
  const image = sharp(input).rotate();
  const cover = `${outBase}.webp`;
  const thumb = `${outBase}.thumb.webp`;
  await image.clone().resize(COVER_SIZE, COVER_SIZE, { fit: 'cover' }).webp({ quality: 72 }).toFile(cover);
  await image.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' }).webp({ quality: 72 }).toFile(thumb);
  return { cover, thumb };
}
