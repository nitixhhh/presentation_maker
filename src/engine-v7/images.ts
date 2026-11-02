/**
 * Engine v7 — the deck's images. The art director asked for at most a few AI pictures; each is made with FLUX.2 klein
 * 4B (Cloudflare Workers AI) in the deck's one image style, checked for painted text, and replaced by a real photo
 * (Wikimedia Commons, the existing photo path) when generation fails, the free quota is used up, or text appears.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { searchCommons, download, photoQueryFromSubject } from "../engine-v3/assets/images";
import { pictureSubject, sizeForAspect } from "../engine-v3/assets/images";
import { imageHasText } from "./qa";
import type { V7Concept, V7Image, V7Slide } from "./types";

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
let quotaHit = false;

function aspectNum(a: string): number {
  const m = String(a).match(/(\d+(?:\.\d+)?)\s*[:x\/]\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) / Number(m[2]) : 16 / 9;
}

async function klein(prompt: string, aspect: number, log: (m: string) => void): Promise<Buffer | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN, acc = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !acc || quotaHit) return null;
  const size = sizeForAspect(aspect);
  const form = new FormData();
  form.append("prompt", prompt.slice(0, 2000));
  form.append("width", String(size.width));
  form.append("height", String(size.height));
  const t0 = Date.now();
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/${MODEL}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 429 || /4006|daily|quota|neurons/i.test(body)) quotaHit = true;
      log(`klein failed: HTTP ${res.status} ${body.replace(/\s+/g, " ").slice(0, 120)}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    let out: Buffer | null = null;
    if (ct.includes("json")) {
      const j: any = await res.json();
      const b64 = j?.result?.image || j?.image;
      if (b64) out = Buffer.from(b64, "base64");
    } else out = Buffer.from(await res.arrayBuffer());
    log(`[v7/images] klein ${size.width}x${size.height} ${Date.now() - t0} ms (~104 neurons)`);
    return out && out.length > 5000 ? out : null;
  } catch (e: any) {
    log(`klein failed: ${String(e?.message || e).slice(0, 100)}`);
    return null;
  }
}

/** The concept's image style minus anything about frames, captions or borders (drawn in HTML; the image model would paint them as letters). */
export function pictureStyle(style: string): string {
  return String(style || "")
    .split(/(?<=[.;])\s+|,\s+(?=presented|shown|placed|set|framed|with (?:a |thin )?(?:caption|border|frame))/i)
    .filter((p) => !/caption|numeral|border|frame|plate number|label|lettering|inscription|typograph|text/i.test(p))
    .join(" ")
    .trim();
}

export function imagePrompt(subject: string, concept: V7Concept): string {
  return [
    pictureSubject(subject) || subject,
    pictureSubject(pictureStyle(concept.imageStyle)),
    `Colour palette leaning on ${concept.palette.slice(0, 3).map((p) => p.hex).join(", ")}`,
    "Clean composition with calm negative space, one clear subject",
    "Absolutely no writing anywhere: no text, no letters, no numbers, no signs, no labels, no logos, no watermark",
  ].filter(Boolean).join(". ") + ".";
}

const NOT_A_PHOTO = /screenshot|profile|logo|icon|diagram|chart|graph|map\b|flag|coat of arms|seal|signature|poster|cover|page|text|table|formula|equation|scholia|wikidata|\.svg|\.pdf|\.tif/i;

async function realPhoto(subject: string, topic: string, dir: string, n: number, used: Set<string>, log: (m: string) => void, stats: { checks: number }): Promise<V7Image | null> {
  const query = photoQueryFromSubject(subject, topic);
  const cands = (await searchCommons(query, 8).catch(() => [])).filter((c) => !NOT_A_PHOTO.test(c.title || "") && /\.jpe?g/i.test(c.url) && !used.has(c.url));
  for (const c of cands.slice(0, 3)) {
    const buf = await download(c.url).catch(() => null);
    if (!buf) continue;
    try {
      const meta = await sharp(buf).metadata();
      if (!meta.width || meta.width < 800) continue;
      const out = await sharp(buf).rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer({ resolveWithObject: true });
      stats.checks++;
      const chk = await imageHasText(out.data, subject);
      if (!chk || chk.text || !chk.fits) { log(`slide ${n}: photo "${(c.title || "").slice(0, 50)}" rejected (${!chk ? "check failed" : chk.text ? "has writing" : "off-subject"})`); continue; }
      used.add(c.url);
      const file = `img/s${n}.jpg`;
      fs.writeFileSync(path.join(dir, file), out.data);
      log(`slide ${n}: real photo "${c.title?.slice(0, 60)}" (query "${query}")`);
      return { n, file, width: out.info.width, height: out.info.height, kind: "photo", subject: c.title || subject, credit: `${c.credit || c.title || "Wikimedia Commons"}` };
    } catch {
      continue;
    }
  }
  log(`slide ${n}: no fitting real photo for "${query}" — the slide will be drawn without a picture`);
  return null;
}

export async function makeImages(concept: V7Concept, slides: V7Slide[], topic: string, dir: string, budget: number, log: (m: string) => void, stats: { ai: number; checks: number; photos: number }): Promise<V7Image[]> {
  fs.mkdirSync(path.join(dir, "img"), { recursive: true });
  const wants = concept.storyboard.filter((b) => b.image?.subject);
  let left = budget;
  const used = new Set<string>();
  const results = await Promise.all(wants.map(async (b) => {
    const aspect = aspectNum(b.image!.aspect);
    // prototype re-runs keep a picture already made for this deck (no second generation)
    const prev = path.join(dir, `img/s${b.n}.jpg`);
    if (process.env.V7_REUSE && fs.existsSync(prev)) {
      const m = await sharp(prev).metadata();
      return { n: b.n, file: `img/s${b.n}.jpg`, width: m.width || 1024, height: m.height || 576, kind: "ai" as const, subject: b.image!.subject, credit: "AI-generated image (FLUX.2 klein, Cloudflare Workers AI)" };
    }
    const prompt = imagePrompt(b.image!.subject, concept);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (left <= 0) break;
      left--;
      const raw = await klein(prompt + (attempt ? " Pure image, zero typography." : ""), aspect, log);
      if (!raw) break;
      stats.ai++;
      const jpg = await sharp(raw).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
      stats.checks++;
      const chk = await imageHasText(jpg.data, b.image!.subject);
      if (chk && chk.text) {
        fs.writeFileSync(path.join(dir, `img/s${b.n}-rejected-${attempt}.jpg`), jpg.data);
        log(`slide ${b.n}: AI image has writing in it — ${attempt ? "trying a real photo" : "trying once more"}`);
        continue;
      }
      const file = `img/s${b.n}.jpg`;
      fs.writeFileSync(path.join(dir, file), jpg.data);
      return { n: b.n, file, width: jpg.info.width, height: jpg.info.height, kind: "ai" as const, subject: b.image!.subject, credit: "AI-generated image (FLUX.2 klein, Cloudflare Workers AI)" };
    }
    const ph = await realPhoto(b.image!.subject, topic, dir, b.n, used, log, stats);
    if (ph) stats.photos++;
    return ph;
  }));
  return results.filter(Boolean) as V7Image[];
}
