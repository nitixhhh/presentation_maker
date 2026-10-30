/** Watermarked preview images: the slide as a flat JPEG with a repeating diagonal mark (no selectable text). */
import fs from "fs";
import path from "path";
import sharp from "sharp";

export async function watermarked(src: string): Promise<Buffer> {
  const out = src.replace(/\.jpg$/, ".wm.jpg");
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) return fs.readFileSync(out);
  const img = sharp(src);
  const { width = 1280, height = 720 } = await img.metadata();
  const label = process.env.WATERMARK_TEXT || "DeckCraft preview";
  const fs_ = Math.round(width / 26);
  const rows: string[] = [];
  for (let y = -height; y < height * 2; y += fs_ * 4.2) {
    for (let x = -width; x < width * 2; x += fs_ * 11) {
      rows.push(`<text x="${x}" y="${y}" font-size="${fs_}" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.18" stroke-width="1.2">${label}</text>`);
    }
  }
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g transform="rotate(-24 ${width / 2} ${height / 2})">${rows.join("")}</g>` +
      `<rect x="0" y="${height - fs_ * 1.9}" width="${width}" height="${fs_ * 1.9}" fill="#111827" fill-opacity="0.72"/>` +
      `<text x="${width / 2}" y="${height - fs_ * 0.65}" text-anchor="middle" font-size="${Math.round(fs_ * 0.8)}" font-family="Inter, Arial, sans-serif" font-weight="600" fill="#ffffff">Preview · unlock for the clean PDF and editable PPTX</text></svg>`
  );
  // slightly lower resolution than the paid export
  const buf = await img
    .resize({ width: Math.min(width, 1100) })
    .composite([{ input: await sharp(svg).resize({ width: Math.min(width, 1100) }).toBuffer() }])
    .jpeg({ quality: 74 })
    .toBuffer();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  return buf;
}
