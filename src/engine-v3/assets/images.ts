/**
 * Engine v3 — Images like a designer would source them.
 *  1. Real photos: Wikimedia Commons (licence + author kept) and Openverse (CC).
 *  2. A vision model picks relevant candidates from one contact sheet (Commons search is noisy).
 *  3. Cloudflare Workers AI Flux for conceptual images when no real photo fits.
 * Every image is stored as a real JPEG on disk (never SVG) with size + average colour,
 * so designers can use it full-bleed, masked, blended, framed …
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import modelsConfig from "@/config/models.json";
import { AI_IMAGE_SAFETY, type ImagePlan } from "../agents/imageDirector";
import { chatJson } from "../llm";
import type { Asset, OutlineSlide } from "../types";

const UA = "DeckCraftAI/3.0 (academic presentation engine)";

interface Candidate {
  url: string; // download url (thumb ~1600px)
  width: number;
  height: number;
  title: string;
  description: string;
  credit: string;
  sourceUrl: string;
  origin: "wikimedia" | "openverse";
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

export async function searchOpenverse(query: string, limit = 4): Promise<Candidate[]> {
  const j = await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit * 2}&license_type=all&mature=false&size=large`
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

async function download(url: string, timeoutMs = 20000, attempt = 0): Promise<Buffer | null> {
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
async function store(buf: Buffer, dir: string, id: string): Promise<{ file: string; width: number; height: number; avgColor: string } | null> {
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

/** Cloudflare Workers AI text-to-image (Flux schnell → SDXL lightning). */
export async function generateImage(prompt: string, style?: string): Promise<Buffer | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const acc = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !acc) return null;
  const base = (process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
  const models: string[] = (modelsConfig as any).engineV3?.imageGeneration?.models || ["@cf/black-forest-labs/flux-1-schnell"];
  for (const model of models) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(`${base}/accounts/${acc}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${prompt}. ${style || "Professional editorial photograph, natural light, sharp focus, rich detail"}. ${AI_IMAGE_SAFETY}.`,
          steps: 8,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("json")) {
        const j: any = await res.json();
        const b64 = j?.result?.image;
        if (b64) return Buffer.from(b64, "base64");
      } else {
        const b = Buffer.from(await res.arrayBuffer());
        if (b.length > 5000) return b;
      }
    } catch {
      /* next model */
    }
  }
  return null;
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

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export async function sourceImages(
  slides: OutlineSlide[],
  dir: string,
  opts: { mode: "real-first" | "ai-allowed" | "none"; topic: string; plan?: ImagePlan },
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

  // 1. search candidates in parallel
  const searched = await Promise.all(
    wants.map(async (w) => {
      if (w.source === "ai") return { w, cands: [] as Candidate[] };
      const [c, o] = await Promise.all([searchCommons(w.query, 5), searchOpenverse(w.query, 3)]);
      let cands = [...c, ...o];
      if (cands.length < 2) {
        // broaden: drop the last word
        const shorter = w.query.split(/\s+/).slice(0, 2).join(" ");
        if (shorter !== w.query) cands = [...cands, ...(await searchCommons(shorter, 4))];
      }
      return { w, cands: cands.slice(0, 6) };
    })
  );

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
      const sheet = await contactSheet(chunk.map((g) => ({ slideN: g.w.slide.n, subject: g.w.query, cands: g.cands })));
      const desc = chunk
        .map((g) => `Slide ${g.w.slide.n} "${g.w.slide.title}" needs: ${g.w.query}. Candidates: ${g.cands.map((x, k) => `${String.fromCharCode(65 + k)}="${x.c.title.slice(0, 60)}"`).join(", ")}`)
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

  // 4. store chosen photos at full size; generate where nothing fits
  const assets: Asset[] = [];
  let k = 0;
  await Promise.all(
    groups.map(async (g) => {
      const n = g.w.slide.n;
      const idx = picks.get(n);
      const id = `img${n}`;
      if (idx !== undefined) {
        const c = g.cands[idx].c;
        const full = (await download(c.url)) || g.cands[idx].buf;
        const st = await store(full, dir, id);
        if (st) {
          assets.push({ id, ...st, mime: "image/jpeg", origin: c.origin, title: c.title, description: c.description, credit: c.credit, sourceUrl: c.sourceUrl, forSlides: [n] });
          k++;
          return;
        }
      }
      if (g.w.allowGenerated) {
        const prompt = g.w.prompt || `${g.w.query}, related to ${opts.topic}`;
        const buf = await generateImage(prompt, style);
        const st = buf ? await store(buf, dir, id) : null;
        if (st) {
          assets.push({ id, ...st, mime: "image/jpeg", origin: "generated", title: prompt.slice(0, 80), description: `AI-generated illustration (deck style): ${prompt}`, credit: "AI-generated image (Flux, Cloudflare Workers AI)", forSlides: [n] });
          return;
        }
      }
      log(`no suitable image for slide ${n} (${g.w.query}) — designer will use typography/diagram`);
    })
  );
  assets.sort((a, b) => a.forSlides[0] - b.forSlides[0]);
  log(`images ready: ${assets.length} (${k} real photos, ${assets.length - k} AI images)`);
  return assets;
}
