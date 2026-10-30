import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DATA_ROOT } from "./paths";

export const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");

/** Normalise an uploaded logo: decode (rejects non-images), trim empty border, max 800px, PNG with transparency. */
export async function saveLogo(buf: Buffer): Promise<string> {
  const meta = await sharp(buf, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) throw new Error("Upload a PNG, JPG or WebP image.");
  let img = sharp(buf).rotate();
  try {
    img = sharp(await img.trim({ threshold: 12 }).toBuffer());
  } catch {
    img = sharp(buf).rotate();
  }
  const out = await img.resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const id = `logo_${crypto.randomBytes(10).toString("hex")}`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, `${id}.png`), out);
  return id;
}

export function logoPath(id: string): string | null {
  if (!/^logo_[a-z0-9]{8,40}$/.test(id)) return null;
  const p = path.join(UPLOADS_DIR, `${id}.png`);
  return fs.existsSync(p) ? p : null;
}
