/**
 * DeckCraft icon library — search + inline SVG for slides.
 *
 * Sets: Lucide (ISC) + Tabler outline/filled (MIT). Both outline sets share the same
 * 24×24 grid, 2px round stroke, currentColor — they mix cleanly on one slide.
 * Data: icons.bundle.json (built by build/build_bundle.py). No external deps.
 *
 *   searchIcons("gpu", 5)                 -> [{ id: "lucide:gpu", ... }, ...]
 *   getIcon("lucide:gpu", { size: 64, color: "#2563eb" }) -> "<svg ...>...</svg>"
 *   expandIconPlaceholders(html)          -> replaces <i data-icon="gpu" ...></i> with inline SVG
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type IconSet = "lucide" | "tabler" | "tabler-filled";
export type IconStyle = "outline" | "filled" | "any";

export interface IconRecord {
  id: string; // "lucide:cpu"
  set: IconSet;
  name: string; // "cpu"
  categories: string[];
  tags: string[];
  aliases: string[];
  body: string; // inner SVG markup, 24×24 viewBox
}

export interface IconHit {
  id: string;
  name: string;
  set: IconSet;
  category: string;
  tags: string[]; // first few tags, for the model to judge fit
  score: number;
}

export interface SearchOptions {
  /** Restrict to one set. Default: lucide + tabler outline (filled only when style is "filled"/"any"). */
  set?: IconSet | "any";
  style?: IconStyle;
  /** Collapse the same name across sets (keep the better one). Default true. */
  dedupe?: boolean;
  /** Allow brand/logo icons (tabler "brand-*") even when the query doesn't say brand/logo. */
  allowBrands?: boolean;
}

export interface IconOptions {
  size?: number | string; // px number or CSS length; default 48
  color?: string; // CSS colour; default "currentColor"
  stroke?: number; // stroke width on the 24 grid; default 2 (ignored for filled icons)
  /** Keep the stroke visually constant regardless of size (stroke * 24 / size). */
  absoluteStroke?: boolean;
  title?: string; // accessible label; omitted => aria-hidden
  className?: string;
  style?: string; // extra inline CSS (sanitised)
  /** Prefer this set when the name is bare ("cpu"). */
  preferSet?: IconSet;
}

interface Concept { k: string[]; e: string[]; p: string[] }
interface Bundle {
  format: string;
  built: string;
  sets: Record<string, { version: string; license: string; source: string; style: string }>;
  icons: [IconSet, string, string, string, string, string][];
  concepts: Concept[];
}

interface Indexed extends IconRecord {
  nameTokens: string[];
  aliasTokens: Set<string>;
  tagSet: Set<string>;
  tagTokens: Set<string>;
  catTokens: Set<string>;
  isBrand: boolean;
}

// ---------------------------------------------------------------- loading

let ICONS: Indexed[] | null = null;
let BY_ID = new Map<string, Indexed>();
let BY_NAME = new Map<string, Indexed[]>(); // name or alias -> records
let CONCEPTS = new Map<string, Concept[]>(); // normalised key -> concepts
let MAX_KEY_WORDS = 1;
let META: Pick<Bundle, "format" | "built" | "sets"> | null = null;

/** Default bundle location: ICONS_BUNDLE_PATH env, else next to this file, else ./icons.bundle.json from cwd. */
function defaultBundlePath(): string {
  const env = process.env.ICONS_BUNDLE_PATH;
  if (env) return env;
  const candidates: string[] = [];
  try {
    // works under tsx / node ESM
    candidates.push(new URL("./icons.bundle.json", import.meta.url).pathname);
  } catch { /* CJS / bundler */ }
  candidates.push(join(process.cwd(), "src/engine-v4/icons/icons.bundle.json"));
  candidates.push(join(process.cwd(), "icons.bundle.json"));
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[candidates.length - 1];
}

/** Load (or replace) the bundle. Called lazily on first use; call explicitly to inject a parsed object. */
export function loadIconBundle(src?: string | Bundle): void {
  const b: Bundle = typeof src === "object" && src
    ? src
    : JSON.parse(readFileSync(src ?? defaultBundlePath(), "utf8"));
  if (!b.format?.startsWith("deckcraft-icons/")) throw new Error("not a deckcraft icon bundle");
  META = { format: b.format, built: b.built, sets: b.sets };
  ICONS = [];
  BY_ID = new Map();
  BY_NAME = new Map();
  for (const [set, name, cats, tags, aliases, body] of b.icons) {
    const tagList = tags ? tags.split("|") : [];
    const aliasList = aliases ? aliases.split("|") : [];
    const catList = cats ? cats.split("|") : [];
    const rec: Indexed = {
      id: `${set}:${name}`, set, name, categories: catList, tags: tagList, aliases: aliasList, body,
      nameTokens: tokens(name),
      aliasTokens: new Set(aliasList.flatMap(tokens)),
      tagSet: new Set(tagList.map((t) => tokens(t).join(" "))),
      tagTokens: new Set(tagList.flatMap(tokens)),
      catTokens: new Set(catList.flatMap(tokens)),
      isBrand: name.startsWith("brand-"),
    };
    ICONS.push(rec);
    BY_ID.set(rec.id, rec);
    for (const n of [name, ...aliasList]) {
      const arr = BY_NAME.get(n) ?? [];
      arr.push(rec);
      BY_NAME.set(n, arr);
    }
  }
  CONCEPTS = new Map();
  for (const c of b.concepts) {
    for (const k of c.k) {
      const key = tokens(k).join(" ") || k.trim();
      MAX_KEY_WORDS = Math.max(MAX_KEY_WORDS, key.split(" ").length);
      const arr = CONCEPTS.get(key) ?? [];
      arr.push(c);
      CONCEPTS.set(key, arr);
    }
  }
}

function ensure(): Indexed[] {
  if (!ICONS) loadIconBundle();
  return ICONS!;
}

export function iconLibraryInfo() {
  ensure();
  const counts: Record<string, number> = {};
  for (const r of ICONS!) counts[r.set] = (counts[r.set] ?? 0) + 1;
  return { ...META!, counts, total: ICONS!.length, concepts: CONCEPTS.size };
}

// ---------------------------------------------------------------- text helpers

const SYMBOLS: Record<string, string> = { "₹": " rupee ", "$": " dollar ", "€": " euro ", "%": " percent ", "&": " and ", "+": " plus " };

export function tokens(s: string): string[] {
  let t = s.toLowerCase();
  for (const [k, v] of Object.entries(SYMBOLS)) t = t.split(k).join(v);
  return t.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us")) return t.slice(0, -1);
  return t;
}

// name modifiers that usually mean "a variant", not the base concept
const MODIFIERS = new Set(["off", "x", "plus", "minus", "slash", "dashed", "cog", "edit", "question", "exclamation",
  "cancel", "check", "search", "share", "star", "bolt", "code", "dollar", "pause", "pin", "heart", "lock", "dot",
  "spark", "down", "up", "left", "right", "move", "back", "pen", "cancel", "alert", "sync", "filled", "fading",
  "export", "import", "bookmark", "upload", "download", "percentage", "discount", "x2", "dots", "ai"]);

// ---------------------------------------------------------------- scoring

function scoreToken(t: string, r: Indexed): number {
  const st = stem(t);
  let best = 0;
  r.nameTokens.forEach((nt, i) => {
    let s = 0;
    if (nt === t || nt === st || stem(nt) === st) s = i === 0 ? 14 : 10;
    else if (t.length >= 3 && nt.startsWith(t)) s = i === 0 ? 7 : 5;
    else if (t.length >= 5 && lev(t, nt, t.length >= 8 ? 2 : 1) <= (t.length >= 8 ? 2 : 1)) s = 4;
    if (s > best) best = s;
  });
  if (best >= 10) return best;
  if (r.aliasTokens.has(t) || r.aliasTokens.has(st)) best = Math.max(best, 8);
  if (r.tagSet.has(t) || r.tagSet.has(st)) best = Math.max(best, 7);
  else if (r.tagTokens.has(t) || r.tagTokens.has(st)) best = Math.max(best, 5);
  else if (best < 3 && t.length >= 4) {
    for (const tt of r.tagTokens) {
      if (tt.startsWith(t)) { best = Math.max(best, 3); break; }
    }
  }
  if (best < 2 && (r.catTokens.has(t) || r.catTokens.has(st))) best = 2;
  return best;
}

/** Score a group of query tokens against an icon (0 = no match). */
function scoreGroup(q: string[], r: Indexed): number {
  if (!q.length) return 0;
  let sum = 0, matched = 0;
  for (const t of q) {
    const s = scoreToken(t, r);
    if (s > 0) { matched++; sum += s; }
  }
  if (!matched) return 0;
  const coverage = matched / q.length;
  let score = sum * coverage * coverage;
  const joined = q.join("-");
  if (r.name === joined || r.aliases.includes(joined)) score += 20;
  // prefer simple names: penalise words the query didn't ask for
  const qset = new Set(q.flatMap((t) => [t, stem(t)]));
  for (const nt of r.nameTokens) {
    if (qset.has(nt) || qset.has(stem(nt))) continue;
    if (/^\d+$/.test(nt)) score -= 1;
    else if (nt === "off") score -= 8;
    else if (MODIFIERS.has(nt)) score -= 3;
    else score -= 1.2;
  }
  return score;
}

function conceptsFor(q: string[]): Concept[] {
  const out: Concept[] = [];
  const seen = new Set<Concept>();
  const add = (key: string): boolean => {
    const cs = CONCEPTS.get(key);
    if (!cs) return false;
    for (const c of cs) if (!seen.has(c)) { seen.add(c); out.push(c); }
    return true;
  };
  add(q.join(" "));
  // longest phrases first; words inside a matched phrase don't trigger their own concepts
  // ("machine learning" should not pull in the education concept for "learning")
  const covered = new Array(q.length).fill(false);
  for (let n = Math.min(MAX_KEY_WORDS, q.length); n >= 1; n--) {
    for (let i = 0; i + n <= q.length; i++) {
      if (covered.slice(i, i + n).some(Boolean)) continue;
      const key = q.slice(i, i + n).join(" ");
      const hit = add(key) || (n === 1 && add(stem(key)));
      if (hit && n > 1) for (let j = i; j < i + n; j++) covered[j] = true;
    }
  }
  return out;
}

export function searchIcons(query: string, limit = 8, opts: SearchOptions = {}): IconHit[] {
  const all = ensure();
  const q = tokens(query).slice(0, 12);
  if (!q.length) return [];
  const style = opts.style ?? "outline";
  const setFilter = opts.set ?? "any";
  const wantsBrand = opts.allowBrands || q.some((t) => t === "brand" || t === "logo" || t === "brands");

  const concepts = conceptsFor(q);
  const expansions = concepts.flatMap((c) => c.e.map((e) => tokens(e)));
  const prefer = new Map<string, number>();
  concepts.forEach((c, ci) => c.p.forEach((name, i) => {
    const bonus = Math.max(4, 36 - i * 6 - ci * 5);
    prefer.set(name, Math.max(prefer.get(name) ?? 0, bonus));
  }));

  const hits: { r: Indexed; score: number }[] = [];
  for (const r of all) {
    if (setFilter !== "any" && r.set !== setFilter) continue;
    if (setFilter === "any") {
      if (style === "outline" && r.set === "tabler-filled") continue;
      if (style === "filled" && r.set !== "tabler-filled") continue;
    }
    let s = scoreGroup(q, r);
    let e = 0;
    for (const ex of expansions) e = Math.max(e, scoreGroup(ex, r));
    s = Math.max(s, 0) + 0.6 * Math.max(e, 0);
    const p = prefer.get(r.name) ?? (r.aliases.map((a) => prefer.get(a) ?? 0).reduce((a, b) => Math.max(a, b), 0));
    if (p && s > 0) s += p;
    else if (p) s = p; // concept says so even if no token overlaps (e.g. "paisa" -> indian-rupee)
    if (s <= 0) continue;
    if (r.isBrand && !wantsBrand) s -= 15;
    if (r.set === "lucide") s += 0.5; // tie-break: Lucide drawings are a little cleaner
    if (s > 0) hits.push({ r, score: s });
  }
  hits.sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length);

  const out: IconHit[] = [];
  const floor = hits.length ? hits[0].score * 0.2 : 0; // drop weak tail (e.g. "telescope-off")
  const seenNames = new Set<string>();
  const dedupe = opts.dedupe !== false;
  for (const { r, score } of hits) {
    if (score < floor) break;
    if (dedupe) {
      if (seenNames.has(r.name)) continue;
      seenNames.add(r.name);
      for (const a of r.aliases) seenNames.add(a);
    }
    out.push({ id: r.id, name: r.name, set: r.set, category: r.categories[0] ?? "", tags: r.tags.slice(0, 6), score: Math.round(score * 10) / 10 });
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------- rendering

/** Resolve "lucide:cpu", "tabler-filled:star", or bare "cpu" / old Lucide alias names. */
export function findIcon(name: string, preferSet?: IconSet): IconRecord | null {
  ensure();
  const n = name.trim().toLowerCase();
  const direct = BY_ID.get(n);
  if (direct) return direct;
  const bare = n.includes(":") ? n.split(":").pop()! : n;
  const slug = tokens(bare).join("-");
  const list = BY_NAME.get(bare) ?? BY_NAME.get(slug);
  if (!list?.length) return null;
  const order: IconSet[] = preferSet ? [preferSet, "lucide", "tabler", "tabler-filled"] : ["lucide", "tabler", "tabler-filled"];
  for (const s of order) {
    const hit = list.find((r) => r.set === s);
    if (hit) return hit;
  }
  return list[0];
}

const COLOR_RE = /^(currentColor|transparent|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/+-]+\)|var\(--[\w-]+\))$/;
const LEN_RE = /^\d{1,4}(\.\d+)?(px|em|rem|%|vw|vh|pt)?$/;

function cleanColor(c: string | undefined, fallback = "currentColor"): string {
  return c && COLOR_RE.test(c.trim()) ? c.trim() : fallback;
}
function cleanLen(v: number | string | undefined, fallback: string): string {
  if (typeof v === "number" && isFinite(v) && v > 0 && v <= 4096) return String(v);
  if (typeof v === "string" && LEN_RE.test(v.trim())) return v.trim();
  return fallback;
}
function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cleanStyle(s: string | undefined): string {
  if (!s) return "";
  // allow simple declarations only; no url(), expressions, imports
  return s.split(";").map((d) => d.trim()).filter((d) => /^[a-z-]+\s*:\s*[^;{}<>"]+$/i.test(d) && !/url\(|expression|@import|javascript:/i.test(d)).join(";");
}

/** Inline SVG for an icon, or null if the name is unknown (call searchIcons for alternatives). */
export function getIcon(name: string, opts: IconOptions = {}): string | null {
  const r = findIcon(name, opts.preferSet);
  if (!r) return null;
  return renderRecord(r, opts);
}

function renderRecord(r: IconRecord, opts: IconOptions): string {
  const size = cleanLen(opts.size, "48");
  const color = cleanColor(opts.color);
  const filled = r.set === "tabler-filled";
  let sw = typeof opts.stroke === "number" && isFinite(opts.stroke) ? Math.min(Math.max(opts.stroke, 0.25), 4) : 2;
  const px = Number(size);
  if (opts.absoluteStroke && isFinite(px) && px > 0) sw = Math.round(((sw * 24) / px) * 1000) / 1000;
  const attrs = [
    `xmlns="http://www.w3.org/2000/svg"`,
    `viewBox="0 0 24 24"`,
    `width="${size}"`,
    `height="${size}"`,
    filled ? `fill="${color}"` : `fill="none"`,
    filled ? `stroke="none"` : `stroke="${color}"`,
    filled ? "" : `stroke-width="${sw}"`,
    filled ? "" : `stroke-linecap="round"`,
    filled ? "" : `stroke-linejoin="round"`,
    `class="${escAttr(["dc-icon", `dc-icon-${r.name}`, opts.className ?? ""].join(" ").trim())}"`,
    `data-icon="${escAttr(`${r.set}:${r.name}`)}"`,
    opts.style ? `style="${escAttr(cleanStyle(opts.style))}"` : "",
    opts.title ? `role="img" aria-label="${escAttr(opts.title)}"` : `aria-hidden="true"`,
  ].filter(Boolean).join(" ");
  const title = opts.title ? `<title>${escAttr(opts.title)}</title>` : "";
  return `<svg ${attrs}>${title}${r.body}</svg>`;
}

/** data: URI for <img src> / CSS background use. */
export function iconDataUri(name: string, opts: IconOptions = {}): string | null {
  const svg = getIcon(name, { ...opts, color: opts.color && opts.color !== "currentColor" ? opts.color : "#000000" });
  return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null;
}

/**
 * Replace placeholders the designer model writes with real inline SVG:
 *   <i data-icon="gpu" data-size="56" data-color="#0ea5e9" data-stroke="1.75"></i>
 * Unknown names fall back to the best search hit; if nothing matches, the placeholder is removed.
 */
export function expandIconPlaceholders(html: string, defaults: IconOptions = {}): { html: string; used: string[]; missing: string[] } {
  const used: string[] = [];
  const missing: string[] = [];
  const out = html.replace(/<(i|span)\b([^>]*\bdata-icon\s*=\s*["'][^"']+["'][^>]*)>\s*<\/\1>/gi, (_m, _tag, attrStr: string) => {
    const a: Record<string, string> = {};
    for (const m of attrStr.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)) a[m[1].toLowerCase()] = m[2];
    const want = a["data-icon"];
    let rec = findIcon(want, defaults.preferSet);
    if (!rec) {
      const hit = searchIcons(want, 1)[0];
      rec = hit ? findIcon(hit.id) : null;
    }
    if (!rec) { missing.push(want); return ""; }
    used.push(`${rec.set}:${rec.name}`);
    return renderRecord(rec, {
      ...defaults,
      size: a["data-size"] ?? defaults.size,
      color: a["data-color"] ?? defaults.color,
      stroke: a["data-stroke"] ? Number(a["data-stroke"]) : defaults.stroke,
      title: a["data-title"] ?? a["aria-label"] ?? defaults.title,
      className: [defaults.className, a["class"]].filter(Boolean).join(" ") || undefined,
      style: a["style"] ?? defaults.style,
    });
  });
  return { html: out, used, missing };
}

/** Strip anything dangerous from an SVG the model wrote by hand (scripts, handlers, foreignObject, external refs). */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<(iframe|object|embed|image|use)\b[^>]*\/?>/gi, (m) => (/href\s*=\s*["']#/.test(m) ? m : ""))
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi, "")
    .replace(/url\(\s*["']?\s*(https?:|javascript:|data:)[^)]*\)/gi, "none");
}

// ---------------------------------------------------------------- tool-calling glue

/** OpenAI-style tool definitions for the designer agent. */
export const ICON_TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "search_icons",
      description:
        "Find icons by concept (English or Hinglish, e.g. 'gpu', 'growth', 'paisa', 'student'). Returns icon ids. Then place one in your HTML as <i data-icon=\"<id>\" data-size=\"48\" data-color=\"#hex\"></i> or call get_icon.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "1–4 words describing the concept" },
          limit: { type: "integer", minimum: 1, maximum: 12, default: 6 },
          style: { type: "string", enum: ["outline", "filled"], default: "outline" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_icon",
      description: "Get the inline SVG for an icon id from search_icons (e.g. 'lucide:cpu').",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          size: { type: "integer", minimum: 12, maximum: 512, default: 48 },
          color: { type: "string", description: "CSS colour, e.g. #2563eb; default currentColor" },
          stroke: { type: "number", minimum: 1, maximum: 3, default: 2 },
        },
        required: ["name"],
      },
    },
  },
] as const;

/** Execute search_icons / get_icon tool calls; returns a JSON string for the tool message. */
export function handleIconTool(tool: string, args: Record<string, unknown>): string {
  if (tool === "search_icons") {
    const q = String(args.query ?? "");
    const limit = Math.min(Math.max(Number(args.limit ?? 6) || 6, 1), 12);
    const style = args.style === "filled" ? "filled" : "outline";
    const hits = searchIcons(q, limit, { style });
    return JSON.stringify({ query: q, results: hits.map((h) => ({ id: h.id, tags: h.tags.slice(0, 4) })) });
  }
  if (tool === "get_icon") {
    const svg = getIcon(String(args.name ?? ""), {
      size: args.size as number | undefined,
      color: args.color as string | undefined,
      stroke: args.stroke as number | undefined,
    });
    if (!svg) {
      const alt = searchIcons(String(args.name ?? ""), 5).map((h) => h.id);
      return JSON.stringify({ error: "unknown icon", suggestions: alt });
    }
    return JSON.stringify({ svg });
  }
  return JSON.stringify({ error: `unknown tool ${tool}` });
}
