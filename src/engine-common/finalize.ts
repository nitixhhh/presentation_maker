/**
 * Final placeholder gate (Standard, Advanced, and decks saved by the retired v4). Student details travel through the AI as {{P1}}..{{Pn}} (privacy.ts); this module
 * puts the real values back and REMOVES every detail row the student left empty (label and value), so no slide, PDF or
 * PPTX can ever show a raw "{{P3}}". Pure string code (no DOM): a tiny tag-matching pass finds the row around a token.
 */
import { fillPlaceholders, type Field } from "../engine-v3/privacy";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use"]);

interface El {
  tag: string;
  start: number; // index of "<"
  innerStart: number;
  innerEnd: number; // index of "</"
  end: number; // index after ">"
}

/** every element with a matching close tag (unclosed elements are ignored) */
export function elementsOf(html: string): El[] {
  const out: El[] = [];
  const stack: { tag: string; start: number; innerStart: number }[] = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)\b[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!m[2]) continue; // comment
    const tag = m[2].toLowerCase();
    if (tag === "style" || tag === "script") {
      if (!m[1]) {
        const close = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        if (close < 0) break;
        const gt = html.indexOf(">", close);
        out.push({ tag, start: m.index, innerStart: re.lastIndex, innerEnd: close, end: gt + 1 });
        re.lastIndex = gt + 1;
      }
      continue;
    }
    if (m[1]) {
      for (let k = stack.length - 1; k >= 0; k--)
        if (stack[k].tag === tag) {
          const o = stack[k];
          stack.length = k;
          out.push({ tag, start: o.start, innerStart: o.innerStart, innerEnd: m.index, end: re.lastIndex });
          break;
        }
    } else if (!m[3] && !VOID.has(tag)) stack.push({ tag, start: m.index, innerStart: re.lastIndex });
  }
  return out;
}

const textOf = (s: string) => s.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const TOKEN = /\{\{\s*[^{}]{0,40}?\s*\}\}/g;

/**
 * The row to delete around a placeholder: the largest element around it whose remaining text is only a short label
 * (≤ 48 characters, no other detail value, no heading/picture/diagram inside).
 */
function rowAround(html: string, els: El[], pos: number, tokLen: number, keep: string[]): El | null {
  const around = els.filter((e) => e.innerStart <= pos && pos + tokLen <= e.innerEnd && !["section", "body", "html", "svg", "style", "h1", "h2", "h3"].includes(e.tag)).sort((a, b) => a.end - a.start - (b.end - b.start));
  let pick: El | null = null;
  for (const e of around) {
    const inner = html.slice(e.innerStart, e.innerEnd);
    if (/<(h1|h2|img|svg|figure|table)\b/i.test(inner) || /data-icon=/.test(inner) && textOf(inner.replace(TOKEN, "")).length > 0 && pick) break;
    const rest = textOf(inner.replace(TOKEN, ""));
    if (rest.length > 48) break;
    if (keep.some((v) => v.length > 1 && rest.includes(v))) break;
    if ((inner.match(TOKEN) || []).length > 1 && pick) break;
    pick = e;
  }
  return pick;
}

/**
 * Final gate for one slide's HTML: real values in, empty/unknown detail rows out, and no "{{…}}" left anywhere.
 * `fields` are only the details the student actually filled (privacy.presenterFields drops empty ones), so any
 * {{Pk}} with k > fields.length is a field they left empty.
 */
export function sanitizePlaceholders(html: string, fields: Field[]): { html: string; removed: string[] } {
  const removed: string[] = [];
  let out = fillPlaceholders(html, fields);
  const keep = fields.map((f) => f.value);
  for (let guard = 0; guard < 24; guard++) {
    TOKEN.lastIndex = 0;
    const m = TOKEN.exec(out);
    if (!m) break;
    const els = elementsOf(out);
    const row = rowAround(out, els, m.index, m[0].length, keep);
    if (row) {
      removed.push(`${m[0]} row "${textOf(out.slice(row.innerStart, row.innerEnd).replace(TOKEN, "")).slice(0, 30)}"`);
      out = out.slice(0, row.start) + out.slice(row.end);
    } else {
      removed.push(m[0]);
      out = out.slice(0, m.index) + out.slice(m.index + m[0].length);
    }
  }
  // any stray braces (a model that wrote "{{Course}}" in an attribute or a half token) — never on a slide
  out = out.replace(/\{\{[^{}]*\}\}/g, "").replace(/\{\{|\}\}/g, "");
  // separators left dangling where a detail was removed ("Rahul · " → "Rahul")
  if (removed.length) out = out.replace(/\s*[·•|]\s*(?=<\/(p|div|span|li|small|strong)>)/g, "").replace(/(<(p|div|span|li)\b[^>]*>)\s*[·•|]\s*/g, "$1");
  return { html: out, removed };
}

/** Label rows on the title slide that carry a known detail label but no value ("Course:", "Date —", "Guide: N/A"). */
const DETAIL_LABEL = /^(presented by|submitted by|prepared by|by|student|students|name|names|roll( no\.?| number)?|enrol+ment( no\.?)?|reg(istration)?( no\.?)?|course|programme|program|class|semester|year|department|dept\.?|institute|institution|college|university|school|guide|under the guidance of|guided by|supervisor|mentor|submitted to|faculty|teacher|professor|subject|date|प्रस्तुतकर्ता|प्रस्तुत कर्ता|द्वारा|नाम|रोल नंबर|रोल नं\.?|अनुक्रमांक|पाठ्यक्रम|कोर्स|विभाग|संस्थान|विश्वविद्यालय|महाविद्यालय|मार्गदर्शक|मार्गदर्शन|दिनांक|तिथि|विषय)\s*[:\-–—]?$/i;
const EMPTY_VAL = /^(n\/?a|tbd|tba|none|—|-|–|_+|…|\.\.\.)$/i;

function isEmptyDetail(t: string): boolean {
  const s = t.trim();
  if (!s || s.length > 40) return false;
  if (DETAIL_LABEL.test(s)) return true; // a label with nothing after it (inside this element)
  const mm = /^(.*?)(?:\s*[:\-–—]\s*|\s+)(n\/?a|tbd|tba|none|—|-|–|_+|…|\.\.\.)$/i.exec(s);
  return !!(mm && DETAIL_LABEL.test(mm[1].trim()));
}

/**
 * Title slide: removes detail labels left without a value — a whole row ("<div><span>Course</span><strong></strong></div>")
 * or, in grid layouts where labels and values are siblings, the orphan label itself. A label followed by its value is kept.
 */
export function removeEmptyDetailRows(html: string): { html: string; removed: string[] } {
  const removed: string[] = [];
  let out = html;
  const skip = new Set<string>();
  for (let guard = 0; guard < 16; guard++) {
    const els = elementsOf(out);
    const smallestAround = (x: El) => els.filter((p) => p.start < x.start && p.end > x.end && !["section", "body", "html"].includes(p.tag)).sort((p, q) => p.end - p.start - (q.end - q.start))[0];
    let hit: El | null = null;
    for (const e of els) {
      if (!["div", "p", "li", "tr", "dd", "dt", "span", "small", "strong", "b", "em", "label", "th", "td"].includes(e.tag)) continue;
      const key = `${e.start}:${out.slice(e.start, e.end)}`;
      if (skip.has(key)) continue;
      const inner = out.slice(e.innerStart, e.innerEnd);
      if (/<(img|svg|h1|h2)\b/i.test(inner)) continue;
      const t = textOf(inner);
      if (!isEmptyDetail(t)) continue;
      let row: El = e;
      let keepIt = false;
      for (;;) {
        const parent = smallestAround(row);
        if (!parent) break;
        const pt = textOf(out.slice(parent.innerStart, parent.innerEnd));
        if (pt === t) {
          row = parent;
          continue;
        }
        if (row === e && DETAIL_LABEL.test(t.trim())) {
          // label and value as siblings: the text after the label, up to the next label, is its value
          const nextLabel = els.filter((q) => q.start >= e.end && q.end <= parent.innerEnd && DETAIL_LABEL.test(textOf(out.slice(q.innerStart, q.innerEnd)))).sort((p, q) => p.start - q.start)[0];
          const seg = textOf(out.slice(e.end, nextLabel ? nextLabel.start : parent.innerEnd)).replace(/^[\s:·•|,–—\-]+|[\s:·•|,–—\-]+$/g, "");
          if (seg && !EMPTY_VAL.test(seg)) keepIt = true;
        }
        break;
      }
      if (keepIt) {
        skip.add(key);
        continue;
      }
      hit = row;
      break;
    }
    if (!hit) break;
    removed.push(`empty "${textOf(out.slice(hit.innerStart, hit.innerEnd)).slice(0, 30)}"`);
    out = out.slice(0, hit.start) + out.slice(hit.end);
  }
  return { html: out, removed };
}

export function hasPlaceholder(s: string): boolean {
  return /\{\{/.test(s || "");
}

type SlideLike = { n: number; html: string; notes?: string };
/**
 * Deck-level gate (pipeline end + before every export): fill + strip on every slide and its notes; title slide also
 * loses label-only rows. Returns what changed; afterwards no slide contains "{{".
 */
export function finalizePlaceholders(deck: { slides: SlideLike[]; brief: { titleSlideFields?: Field[] }; outline?: { slides: { n: number; role: string }[] } }): string[] {
  const fields = deck.brief?.titleSlideFields || [];
  const log: string[] = [];
  for (const s of deck.slides) {
    const role = deck.outline?.slides.find((o) => o.n === s.n)?.role || (s.n === 1 ? "title" : "");
    const a = sanitizePlaceholders(s.html || "", fields);
    let html = a.html;
    const rm = a.removed.slice();
    if (role === "title" || s.n === 1) {
      const b = removeEmptyDetailRows(html);
      html = b.html;
      rm.push(...b.removed);
    }
    if (html !== s.html) {
      s.html = html;
      log.push(`slide ${s.n}: ${rm.join(", ") || "filled details"}`);
    }
    if (s.notes && hasPlaceholder(s.notes)) s.notes = sanitizePlaceholders(s.notes, fields).html;
    if (hasPlaceholder(s.html)) throw new Error(`placeholder left on slide ${s.n} after the final gate`);
  }
  return log;
}

/** Export-side proof: no slide XML inside the PPTX carries "{{" (throws so a broken file is never offered). */
export async function assertNoPlaceholdersInPptx(pptx: Buffer, deckId = ""): Promise<void> {
  let JSZip: any;
  try {
    JSZip = (await import("jszip")).default;
  } catch {
    return; // jszip ships with pptxgenjs; without it the HTML gate above is the check
  }
  const zip = await JSZip.loadAsync(pptx);
  const bad: string[] = [];
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(name)) continue;
    const xml: string = await zip.files[name].async("string");
    if (/\{\{/.test(xml)) bad.push(name);
  }
  if (bad.length) throw new Error(`placeholder text left in the PPTX of deck ${deckId}: ${bad.join(", ")}`);
}
