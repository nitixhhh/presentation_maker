/**
 * Engine v3 — Images like a designer would source them.
 *  1. Real photos: Wikimedia Commons + Wikipedia article lead images (licence + author kept), Openverse
 *     (CC licences that allow commercial use), NASA Image Library (public domain, no key), and Pexels /
 *     Pixabay when a free key is set (PEXELS_API_KEY / PIXABAY_API_KEY — no card needed; skipped otherwise).
 *  2. A vision model picks relevant candidates from one contact sheet (Commons search is noisy).
 *  3. Cloudflare Workers AI for conceptual images when no real photo fits: FLUX.1 schnell (Basic/Standard) or
 *     FLUX.2 klein 4B sized to the slot (Advanced plan, opts.aiTier = "advanced"). No other model: a failed AI image
 *     becomes a real photo.
 * Every image is stored as a real JPEG on disk (never SVG) with size + average colour,
 * so designers can use it full-bleed, masked, blended, framed …
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import modelsConfig from "@/config/models.json";
import { AI_IMAGE_SAFETY, type ImagePlan } from "../agents/imageDirector";
import { chatJson } from "../llm";
import { canGenerate, recordGeneration, isDailyQuotaError, perDeckLimit } from "./imageBudget";
import type { Asset, OutlineSlide } from "../types";

const UA = "DeckCraftAI/3.0 (academic presentation engine)";

export interface Candidate {
  url: string; // download url (thumb ~1600px)
  width: number;
  height: number;
  title: string;
  description: string;
  credit: string;
  sourceUrl: string;
  origin: "wikimedia" | "openverse" | "nasa" | "pexels" | "pixabay";
}

async function getJson(url: string, timeoutMs = 12000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const strip = (s: string) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function searchCommons(query: string, limit = 6): Promise<Candidate[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=${limit * 3}&gsrsearch=${encodeURIComponent(
    `${query} filetype:bitmap`
  )}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`;
  const j = await getJson(url);
  const pages = Object.values(j?.query?.pages || {}) as any[];
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  const out: Candidate[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png/.test(ii.mime)) continue;
    if (ii.width < 800 || ii.height < 450) continue;
    const ar = ii.width / ii.height;
    if (ar > 3 || ar < 0.33) continue;
    const md = ii.extmetadata || {};
    const title = String(p.title || "").replace(/^File:/, "").replace(/\.[a-z]+$/i, "");
    if (/logo|icon|map of|flag of|coat of arms|signature|diagram|diagrama|esquema|schema|schéma|chart|graph|scheme|schematic|plot|spectrum|spectra|formula|structure of|svg|screenshot|drawing/i.test(title)) continue;
    const artist = strip(md.Artist?.value || "Unknown author").slice(0, 80);
    const lic = strip(md.LicenseShortName?.value || "see source");
    out.push({
      url: ii.thumburl || ii.url,
      width: ii.thumbwidth || ii.width,
      height: ii.thumbheight || ii.height,
      title,
      description: strip(md.ImageDescription?.value || title).slice(0, 200),
      credit: `${artist}, ${lic}, via Wikimedia Commons`,
      sourceUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      origin: "wikimedia",
    });
    if (out.length >= limit * 2) break;
  }
  // real photographs (JPEG) first; PNGs are often diagrams/screenshots
  out.sort((a, b) => Number(/\.png/i.test(b.url)) - Number(/\.png/i.test(a.url)) || 0);
  return out.filter((c, i) => i < limit);
}

/** Commons file pages → candidates (shared by Commons search and Wikipedia lead images). */
async function commonsFiles(titles: string[]): Promise<Candidate[]> {
  if (!titles.length) return [];
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(titles.map((t) => (t.startsWith("File:") ? t : `File:${t}`)).join("|"))}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`;
  const j = await getJson(url);
  const out: Candidate[] = [];
  for (const p of Object.values(j?.query?.pages || {}) as any[]) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png/.test(ii.mime) || ii.width < 640 || ii.height < 400) continue;
    const ar = ii.width / ii.height;
    if (ar > 3 || ar < 0.33) continue;
    const md = ii.extmetadata || {};
    const title = String(p.title || "").replace(/^File:/, "").replace(/\.[a-z]+$/i, "");
    if (/logo|icon|flag of|coat of arms|signature|svg|screenshot/i.test(title)) continue;
    out.push({
      url: ii.thumburl || ii.url,
      width: ii.thumbwidth || ii.width,
      height: ii.thumbheight || ii.height,
      title,
      description: strip(md.ImageDescription?.value || title).slice(0, 200),
      credit: `${strip(md.Artist?.value || "Unknown author").slice(0, 80)}, ${strip(md.LicenseShortName?.value || "see source")}, via Wikimedia Commons`,
      sourceUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      origin: "wikimedia",
    });
  }
  return out;
}

/**
 * Wikipedia article lead images: the photo an encyclopedia chose for the article is usually the clearest,
 * most relevant real photo of the subject (Commons keyword search is noisy). Licence/author come from Commons.
 */
export async function searchWikipediaLead(query: string, limit = 3): Promise<Candidate[]> {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit + 2}&prop=pageimages&piprop=name`);
  const pages = (Object.values(j?.query?.pages || {}) as any[]).sort((a, b) => (a.index || 0) - (b.index || 0));
  const names = pages.map((p) => p.pageimage).filter((n: any) => typeof n === "string" && !/\.(svg|gif)$/i.test(n));
  return (await commonsFiles(names.slice(0, limit))).slice(0, limit);
}

/** NASA Image and Video Library: public-domain photos (space, Earth, aviation, science), no key needed. */
export async function searchNasa(query: string, limit = 2): Promise<Candidate[]> {
  const j = await getJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${limit * 3}`, 8000);
  const out: Candidate[] = [];
  for (const it of j?.collection?.items || []) {
    const d = it.data?.[0];
    const link = (it.links || []).find((l: any) => l.rel === "preview" || l.render === "image");
    if (!d || !link?.href) continue;
    // ~orig is the full photo; the API's own size variants follow the same pattern
    const url = String(link.href).replace(/~thumb\.jpg$/i, "~medium.jpg").replace(/^http:/, "https:");
    out.push({
      url,
      width: 1280,
      height: 853,
      title: String(d.title || query).slice(0, 100),
      description: strip(d.description || d.title || query).slice(0, 200),
      credit: `${d.photographer || d.secondary_creator || d.center || "NASA"}, public domain, via NASA Image Library`.replace(/\s+/g, " "),
      sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id || "")}`,
      origin: "nasa",
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Pexels (free key from pexels.com/api, no card). Skipped when PEXELS_API_KEY is not set. */
export async function searchPexels(query: string, limit = 3): Promise<Candidate[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`, { headers: { Authorization: key, "User-Agent": UA }, signal: ctrl.signal });
    const j: any = r.ok ? await r.json() : null;
    return (j?.photos || []).slice(0, limit).map((p: any) => ({
      url: p.src?.large2x || p.src?.large || p.src?.original,
      width: 1880,
      height: Math.round((1880 * (p.height || 2)) / (p.width || 3)),
      title: String(p.alt || query).slice(0, 100),
      description: String(p.alt || query).slice(0, 200),
      credit: `Photo by ${p.photographer || "unknown"} on Pexels (Pexels licence)`,
      sourceUrl: p.url,
      origin: "pexels" as const,
    })).filter((c: Candidate) => c.url);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** Pixabay (free key from pixabay.com/api/docs, no card). Skipped when PIXABAY_API_KEY is not set. */
export async function searchPixabay(query: string, limit = 3): Promise<Candidate[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const j = await getJson(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query.slice(0, 100))}&image_type=photo&orientation=horizontal&safesearch=true&per_page=${Math.max(3, limit)}`, 10000);
  return (j?.hits || []).slice(0, limit).map((h: any) => ({
    url: h.largeImageURL || h.webformatURL,
    width: h.imageWidth || 1280,
    height: h.imageHeight || 853,
    title: String(h.tags || query).slice(0, 100),
    description: String(h.tags || query).slice(0, 200),
    credit: `Image by ${h.user || "unknown"} on Pixabay (Pixabay licence)`,
    sourceUrl: h.pageURL,
    origin: "pixabay" as const,
  })).filter((c: Candidate) => c.url);
}

export async function searchOpenverse(query: string, limit = 4): Promise<Candidate[]> {
  // licences that allow commercial use (decks are sold); short timeout: the API is often slow from servers
  const j = await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit * 2}&license_type=commercial&mature=false&size=large`,
    8000
  );
  const out: Candidate[] = [];
  for (const r of j?.results || []) {
    if (!r.url || (r.width && r.width < 800)) continue;
    if (/\.svg|\.gif/i.test(r.url)) continue;
    out.push({
      url: r.url,
      width: r.width || 1200,
      height: r.height || 800,
      title: r.title || query,
      description: r.title || query,
      credit: `${r.creator || "Unknown"}, ${String(r.license || "").toUpperCase()} ${r.license_version || ""}, via ${r.provider || "Openverse"}`.replace(/\s+/g, " "),
      sourceUrl: r.foreign_landing_url || r.url,
      origin: "openverse",
    });
    if (out.length >= limit) break;
  }
  return out;
}

// Wikimedia rate-limits bursts of thumbnail downloads → at most 4 at a time, retry 429/503 with backoff.
let active = 0;
const waiters: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

export async function download(url: string, timeoutMs = 20000, attempt = 0): Promise<Buffer | null> {
  const res = await slot(() => downloadOnce(url, timeoutMs));
  if (res === "retry" && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    return download(url, timeoutMs, attempt + 1);
  }
  return res === "retry" ? null : res;
}

async function downloadOnce(url: string, timeoutMs: number): Promise<Buffer | null | "retry"> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (r.status === 429 || r.status === 503) return "retry";
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 5000 ? b : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Normalise any raster into a JPEG ≤1600px and measure it. */
export async function store(buf: Buffer, dir: string, id: string): Promise<{ file: string; width: number; height: number; avgColor: string } | null> {
  try {
    const img = sharp(buf, { failOn: "none" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" });
    const out = await img.jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    const stats = await sharp(out.data).stats();
    const [r, g, b] = stats.channels.map((c) => Math.round(c.mean));
    const file = `${id}.jpg`;
    fs.writeFileSync(path.join(dir, file), out.data);
    return { file, width: out.info.width, height: out.info.height, avgColor: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}` };
  } catch {
    return null;
  }
}

/** Which Cloudflare model makes an AI image: "basic" (Basic/Standard plans) or "advanced" (the Advanced plan, engine v6). */
export type AiImageTier = "basic" | "advanced";
const IMG_CFG = ((modelsConfig as any).engineV3?.imageGeneration || {}) as { basic?: string; basicSteps?: number; advanced?: string };
export const AI_IMAGE_MODELS: Record<AiImageTier, { id: string; label: string }> = {
  basic: { id: IMG_CFG.basic || "@cf/black-forest-labs/flux-1-schnell", label: "FLUX.1 schnell" },
  advanced: { id: IMG_CFG.advanced || "@cf/black-forest-labs/flux-2-klein-4b", label: "FLUX.2 klein" },
};
export const aiImageCredit = (tier: AiImageTier = "basic") => `AI-generated image (${AI_IMAGE_MODELS[tier].label}, Cloudflare Workers AI)`;

/** Output size for an image slot of this aspect (width / height): long side 1024, multiples of 16, within klein's
 *  256–1920 range. ≤1024 on both sides keeps one image at ≤4 tiles (≈104 neurons). */
export function sizeForAspect(aspect?: number): { width: number; height: number } {
  const a = aspect && Number.isFinite(aspect) && aspect > 0 ? Math.min(2.4, Math.max(0.5, aspect)) : 4 / 3;
  const r16 = (v: number) => Math.max(256, Math.min(1920, Math.round(v / 16) * 16));
  return a >= 1 ? { width: 1024, height: r16(1024 / a) } : { width: r16(1024 * a), height: 1024 };
}

/** Words that make an image model paint lettering (a quoted title, "slide", "poster" …) are removed from the subject. */
export function pictureSubject(prompt: string): string {
  return String(prompt || "")
    .replace(/["“”«»][^"“”«»]{0,160}["“”«»]/g, " ") // a quoted title would be painted as (garbled) lettering
    .replace(/\b(for|in|on) (a|the|an) (class |college |school )?(presentation|slide|deck|seminar|lecture|poster)( on| about)?\b/gi, " ")
    .replace(/\b(presentation|slides?|deck|poster|infographic|banner|title|caption|headline|label(l?ed|s)?|typography|text|words?|letters?|logo)\b/gi, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.;:])(\s*[,.;:])+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "");
}

/** The Advanced plan's prompt: the subject, the deck's look, a calm composition for the slot's shape, and no text. */
export function slidePrompt(prompt: string, style?: string, aspect?: number): string {
  const shape = !aspect ? "" : aspect >= 1.5 ? "wide landscape photograph, main subject on the right third, plain soft background on the left, " : aspect <= 0.85 ? "vertical portrait photograph, subject centred, " : "";
  return [
    pictureSubject(prompt) || "a calm natural scene",
    pictureSubject(style || "") || "Professional editorial photograph, natural light, sharp focus, rich detail",
    `${shape}one clear subject, simple uncluttered background`,
    "A pure photograph with no writing anywhere: no text, no letters, no words, no numbers, no signs, no logos, no watermark",
  ].join(". ") + ".";
}

/**
 * Cloudflare Workers AI text-to-image, within the daily budget (assets/imageBudget.ts). One model per call, no model
 * fallback: when it fails or the day's allowance is used up the caller uses a real photo.
 *  - basic (default): FLUX.1 schnell, JSON input, 4 steps, square 1024.
 *  - advanced: FLUX.2 klein 4B, multipart/form-data input (prompt, width, height; steps are fixed at 4), sized to the slot.
 */
export async function generateImage(prompt: string, style?: string, log?: (m: string) => void, gen?: { tier?: AiImageTier; aspect?: number; slide?: number }): Promise<Buffer | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const acc = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !acc) return null;
  const gate = await canGenerate();
  if (!gate.ok) {
    log?.(`AI image skipped: ${gate.reason}`);
    return null;
  }
  const base = (process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
  const tier: AiImageTier = gen?.tier === "advanced" ? "advanced" : "basic";
  const model = AI_IMAGE_MODELS[tier].id;
  const t0 = Date.now();
  let size = { width: 1024, height: 1024 };
  const steps = Math.max(1, Math.min(8, Number(IMG_CFG.basicSteps) || 4));
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    let init: RequestInit;
    if (tier === "advanced") {
      size = sizeForAspect(gen?.aspect);
      const form = new FormData();
      form.append("prompt", slidePrompt(prompt, style, gen?.aspect).slice(0, 2000));
      form.append("width", String(size.width));
      form.append("height", String(size.height));
      // fetch writes the multipart Content-Type (with its boundary) itself
      init = { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: ctrl.signal };
    } else {
      init = {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${prompt}. ${style || "Professional editorial photograph, natural light, sharp focus, rich detail"}. ${AI_IMAGE_SAFETY}.`, steps }),
        signal: ctrl.signal,
      };
    }
    const res = await fetch(`${base}/accounts/${acc}/ai/run/${model}`, init);
    clearTimeout(timer);
    if (!res.ok) {
      // say why in the host log (daily free allowance used up, token without Workers AI permission …)
      const body = (await res.text().catch(() => "")).slice(0, 300);
      console.warn(`[v3/images] AI image ${model} failed: HTTP ${res.status} ${body.slice(0, 200)}`);
      if (isDailyQuotaError(res.status, body)) {
        // the allowance is per account, not per model: stop asking Cloudflare for the rest of the day
        await recordGeneration("quota");
        log?.("Cloudflare's free daily image allowance is used up — real photos instead");
        return null;
      }
      await recordGeneration("fail");
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    let out: Buffer | null = null;
    if (ct.includes("json")) {
      const j: any = await res.json();
      const b64 = j?.result?.image || j?.image;
      if (b64) out = Buffer.from(b64, "base64");
    } else {
      const b = Buffer.from(await res.arrayBuffer());
      if (b.length > 5000) out = b;
    }
    if (out && out.length > 1000) {
      await recordGeneration("ok", { model, width: size.width, height: size.height, steps: tier === "basic" ? steps : 4, ms: Date.now() - t0, slide: gen?.slide });
      return out;
    }
  } catch (e: any) {
    console.warn(`[v3/images] AI image ${model} failed: ${String(e?.message || e).slice(0, 160)}`);
  }
  await recordGeneration("fail");
  return null;
}

/** 2–6 search words from an AI-image subject sentence (for the real-photo fallback). */
export function photoQueryFromSubject(subject: string, fallback: string): string {
  const STOP = new Set("a an the of and or with in on at to for from by into over under showing shows show depicting depict image photo picture illustration scene concept view close up close-up background foreground its their his her that this these those is are being as like very soft clean minimal style".split(" "));
  const words = String(subject || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  const q = words.slice(0, 5).join(" ");
  return (q.length >= 3 ? q : fallback).slice(0, 80);
}

interface Want {
  slide: OutlineSlide;
  query: string;
  prompt?: string;
  allowGenerated: boolean;
  source: "real" | "ai";
}

/** Build a labelled contact sheet of candidates for a vision model. */
async function contactSheet(groups: { slideN: number; subject: string; cands: { c: Candidate; buf: Buffer }[] }[]): Promise<Buffer> {
  const tile = 220, th = 150, cols = 6;
  const rows = groups.length;
  const W = cols * tile + 200, H = rows * (th + 30) + 10;
  const composites: { input: Buffer; left: number; top: number }[] = [];
  const svgText: string[] = [];
  for (let r = 0; r < rows; r++) {
    const g = groups[r];
    const y = 10 + r * (th + 30);
    svgText.push(`<text x="8" y="${y + 20}" font-size="15" font-family="sans-serif" font-weight="bold">Slide ${g.slideN}</text>`);
    svgText.push(`<text x="8" y="${y + 40}" font-size="11" font-family="sans-serif">${esc(g.subject.slice(0, 26))}</text>`);
    for (let i = 0; i < Math.min(cols, g.cands.length); i++) {
      const x = 200 + i * tile;
      const thumb = await sharp(g.cands[i].buf).resize(tile - 10, th, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer().catch(() => null);
      if (thumb) composites.push({ input: thumb, left: x, top: y });
      svgText.push(`<rect x="${x}" y="${y}" width="34" height="22" fill="#000"/><text x="${x + 6}" y="${y + 16}" font-size="15" fill="#fff" font-family="sans-serif" font-weight="bold">${String.fromCharCode(65 + i)}</text>`);
    }
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgText.join("")}</svg>`);
  return sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite([...composites, { input: svg, left: 0, top: 0 }])
    .jpeg({ quality: 75 })
    .toBuffer();
}

function dedupe(c: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return c.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export async function sourceImages(
  slides: OutlineSlide[],
  dir: string,
  opts: { mode: "real-first" | "ai-allowed" | "none"; topic: string; plan?: ImagePlan; aiTier?: AiImageTier; aspectFor?: (n: number) => number | undefined },
  log: (m: string) => void
): Promise<Asset[]> {
  if (opts.mode === "none") return [];
  const byN = new Map(slides.map((s) => [s.n, s]));
  // The image director (AI) decided real photo vs AI image per slide; without a plan, use the story agent's suggestion.
  const wants: Want[] = opts.plan
    ? opts.plan.items
        .filter((it) => it.source !== "none" && byN.has(it.n))
        .map((it) => ({
          slide: byN.get(it.n)!,
          source: it.source as "real" | "ai",
          query: (it.query || byN.get(it.n)!.title).slice(0, 80),
          prompt: it.subject,
          // a real-photo slide may fall back to an AI image only when authenticity is not required
          allowGenerated: it.source === "ai" || !it.authentic,
        }))
    : slides
        .filter((s) => s.visual.kind === "photo" || s.visual.kind === "generated")
        .map((s) => ({
          slide: s,
          source: s.visual.kind === "generated" ? ("ai" as const) : ("real" as const),
          query: (s.visual.query || s.visual.prompt || s.title).slice(0, 80),
          prompt: s.visual.prompt,
          allowGenerated: opts.mode === "ai-allowed" || s.visual.kind === "generated",
        }));
  if (!wants.length) return [];
  const style = opts.plan?.style || "";
  if (style) log(`AI image style for this deck: ${style}`);

  // 0. AI images start at once (within today's Cloudflare budget and the per-deck cap); an AI slot whose image does not
  //    come back (quota used up, error, timeout) falls back to a real, attributed photo found for the same subject.
  const deckCap = perDeckLimit();
  let aiAsked = 0;
  const generated = new Map<number, Buffer>();
  const aiFailed = new Set<number>();
  const tryGenerate = async (w: Want): Promise<Buffer | null> => {
    if (aiAsked >= deckCap) {
      log(`AI image for slide ${w.slide.n} skipped: this deck already used its ${deckCap} AI images`);
      return null;
    }
    aiAsked++;
    return generateImage(w.prompt || `${w.query}, related to ${opts.topic}`, style, log, { tier: opts.aiTier, aspect: opts.aspectFor?.(w.slide.n), slide: w.slide.n });
  };
  const searchFor = async (w: Want, query: string): Promise<Candidate[]> => {
    const [lead, c, o, nasa, px, pb] = await Promise.all([
      searchWikipediaLead(query, 2),
      searchCommons(query, 5),
      searchOpenverse(query, 3),
      searchNasa(query, 2),
      searchPexels(query, 2),
      searchPixabay(query, 2),
    ]);
    let cands = dedupe([...lead, ...px, ...pb, ...c, ...o, ...nasa]);
    if (cands.length < 3) {
      // broaden: shorter queries (first two words, last two words) and the deck topic itself
      const words = query.split(/\s+/);
      const variants = Array.from(new Set([words.slice(0, 2).join(" "), words.slice(-2).join(" "), opts.topic])).filter((q) => q && q !== query);
      for (const q of variants) {
        if (cands.length >= 4) break;
        const more = await Promise.all([searchCommons(q, 4), searchWikipediaLead(q, 2)]);
        cands = dedupe([...cands, ...more.flat()]);
      }
    }
    return cands.slice(0, 6);
  };

  // 1. search candidates in parallel (AI slots search their subject at the same time as the image is generated,
  //    so the fallback costs no extra wait; the search results are dropped when the AI image arrives)
  const searched = await Promise.all(
    wants.map(async (w) => {
      if (w.source === "ai") {
        const [buf, cands] = await Promise.all([tryGenerate(w), searchFor(w, photoQueryFromSubject(w.prompt || "", w.query))]);
        if (buf) {
          generated.set(w.slide.n, buf);
          return { w, cands: [] as Candidate[] };
        }
        aiFailed.add(w.slide.n);
        return { w, cands };
      }
      return { w, cands: await searchFor(w, w.query) };
    })
  );
  if (aiFailed.size) log(`AI image unavailable for slide(s) ${[...aiFailed].join(", ")} — searching real photos for them instead`);

  log(`photo candidates: ${searched.map(({ w, cands }) => `slide ${w.slide.n}: ${cands.length}`).join(", ")}`);
  // 2. download thumbnails for the contact sheet
  const groups = await Promise.all(
    searched.map(async ({ w, cands }) => {
      const got = await Promise.all(cands.map(async (c) => ({ c, buf: await download(c.url) })));
      return { w, cands: got.filter((g) => g.buf) as { c: Candidate; buf: Buffer }[] };
    })
  );

  // 3. vision model picks (one call per ≤6 slides)
  const picks = new Map<number, number>(); // slide n -> candidate index
  const withCands = groups.filter((g) => g.cands.length);
  for (let i = 0; i < withCands.length; i += 6) {
    const chunk = withCands.slice(i, i + 6);
    try {
      const need = (w: Want) => (w.source === "ai" ? (w.prompt || w.query).slice(0, 140) : w.query);
      const sheet = await contactSheet(chunk.map((g) => ({ slideN: g.w.slide.n, subject: need(g.w), cands: g.cands })));
      const desc = chunk
        .map((g) => `Slide ${g.w.slide.n} "${g.w.slide.title}" needs: ${need(g.w)}. Candidates: ${g.cands.map((x, k) => `${String.fromCharCode(65 + k)}="${x.c.title.slice(0, 60)}"`).join(", ")}`)
        .join("\n");
      const { data } = await chatJson<{ picks: { slide: number; choice: string }[] }>("vision", [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a photo editor for an academic presentation about "${opts.topic}". For each slide row in the contact sheet choose the ONE photo that best and most accurately shows what the slide needs — sharp, well-lit, professional, relevant to the subject (a wrong subject is worse than no photo). Prefer real photographs of the actual subject. Reject diagrams, charts, plots, drawings with text labels (especially in other languages), screenshots, documents, scans of text, cluttered low-quality snapshots, maps, logos, emoji, cartoons and clip-art. Answer "none" when no candidate truly fits.\n${desc}\nReply ONLY JSON: {"picks":[{"slide":1,"choice":"A"}]}`,
            },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${sheet.toString("base64")}` } },
          ],
        },
      ], { temperature: 0.1, maxTokens: 1500, label: "photo editor" });
      for (const p of data.picks || []) {
        const idx = String(p.choice || "").trim().toUpperCase().charCodeAt(0) - 65;
        const g = chunk.find((x) => x.w.slide.n === Number(p.slide));
        if (g && idx >= 0 && idx < g.cands.length) picks.set(g.w.slide.n, idx);
      }
    } catch (e: any) {
      log(`photo editor unavailable (${String(e.message).slice(0, 80)}) — using first search result`);
      for (const g of chunk) picks.set(g.w.slide.n, 0);
    }
  }

  // never the same photo on two slides: a later slide whose pick is already used takes its next candidate
  const usedUrls = new Set<string>();
  for (const g of [...groups].sort((a, b) => a.w.slide.n - b.w.slide.n)) {
    const idx = picks.get(g.w.slide.n);
    if (idx === undefined) continue;
    let j = idx;
    if (usedUrls.has(g.cands[idx].c.sourceUrl)) {
      j = g.cands.findIndex((x) => !usedUrls.has(x.c.sourceUrl));
      if (j < 0) {
        picks.delete(g.w.slide.n);
        continue;
      }
      picks.set(g.w.slide.n, j);
    }
    usedUrls.add(g.cands[j].c.sourceUrl);
  }

  // 4. store AI images and chosen photos at full size; generate where nothing fits
  const assets: Asset[] = [];
  let k = 0;
  const storeGenerated = async (n: number, id: string, prompt: string, buf: Buffer) => {
    const st = await store(buf, dir, id);
    if (!st) return false;
    assets.push({ id, ...st, mime: "image/jpeg", origin: "generated", title: prompt.slice(0, 80), description: `AI-generated illustration (deck style): ${prompt}`, credit: aiImageCredit(opts.aiTier), forSlides: [n] });
    return true;
  };
  await Promise.all(
    searched.map(async ({ w }) => {
      const n = w.slide.n;
      const id = `img${n}`;
      const prompt = w.prompt || `${w.query}, related to ${opts.topic}`;
      const gen = generated.get(n);
      if (gen && (await storeGenerated(n, id, prompt, gen))) return;
      const g = groups.find((x) => x.w.slide.n === n);
      const idx = picks.get(n);
      if (g && idx !== undefined) {
        const c = g.cands[idx].c;
        const full = (await download(c.url)) || g.cands[idx].buf;
        const st = await store(full, dir, id);
        if (st) {
          assets.push({ id, ...st, mime: "image/jpeg", origin: c.origin, title: c.title, description: c.description, credit: c.credit, sourceUrl: c.sourceUrl, forSlides: [n] });
          k++;
          if (aiFailed.has(n)) log(`slide ${n}: real photo instead of the AI image — "${c.title.slice(0, 60)}" (${c.credit.slice(0, 60)})`);
          return;
        }
      }
      // a real-photo slot with nothing fitting may get an AI image when authenticity is not required
      if (w.source === "real" && w.allowGenerated) {
        const buf = await tryGenerate(w);
        if (buf && (await storeGenerated(n, id, prompt, buf))) return;
      }
      log(`no suitable image for slide ${n} (${w.query}) — designer will use typography/diagram`);
    })
  );
  assets.sort((a, b) => a.forSlides[0] - b.forSlides[0]);
  log(`images ready: ${assets.length} (${k} real photos, ${assets.length - k} AI images)`);
  return assets;
}
