/**
 * Engine v5 — designer-made slide TEMPLATES. Each template is a pure function (content slots, deck context) → slide
 * HTML that uses only the shared stylesheet (styles.ts) and theme variables (themes.ts). Layouts are flex/grid that
 * stretch to the content area, so few items get bigger type and cards (auto-fit grows --s) and many items shrink to
 * the floors (20px body / 18px labels) — never past their boxes. The AI only picks a template id and fills the slots.
 */
import type { Theme } from "./themes";

export interface SlotItem { title?: string; text?: string; icon?: string; value?: string; label?: string }
export interface Side { title: string; icon?: string; points: string[] }
export interface ChartSlot { kind: "bars" | "line" | "donut"; unit?: string; items: { label: string; value: number }[] }

export interface SlideContent {
  template: string;
  title: string;
  eyebrow?: string;
  lede?: string;
  items?: SlotItem[];
  stat?: { value: string; label: string; text?: string };
  quote?: { text: string; author?: string; role?: string };
  left?: Side;
  right?: Side;
  chart?: ChartSlot;
  table?: { columns: string[]; rows: string[][] };
  takeaway?: string;
  term?: string;
  axes?: { x?: string; y?: string };
  center?: string;
  diagram?: string;
  /** asset id ("img3") the engine found for this slide; undefined → the template's no-photo variant */
  photo?: string;
  photoQuery?: string;
  photoFocus?: string;
  notes?: string;
  /** reference numbers cited on this slide (footer "Sources: [2], [5]") */
  cites?: number[];
  /** engine v6: the story beat (question, context, evidence, mechanism, implication, counterpoint, answer) */
  beat?: string;
  /** engine v6 flowchart: nodes + edges (the engine draws it; the model never writes diagram code) */
  flow?: { nodes: { id: string; label: string; type?: string }[]; edges: { from: string; to: string; label?: string }[] };
  /** engine-drawn SVG for this slide (flowchart), made before render */
  svg?: string;
}

export interface RenderCtx {
  theme: Theme;
  deckTitle: string;
  n: number;
  total: number;
  fields: { label: string; value: string }[];
  logo: boolean;
  language: string;
  /** for the engine-built references slide */
  references?: { n: number; text: string; kind?: string; count?: number }[];
  credits?: string[];
  /** engine v6: the deck's headline number, shown on a title slide that has no photo */
  heroStat?: { value: string; label: string };
  /** a few topic icons from the deck (art panel of hero slides without a photo) */
  deckIcons?: string[];
  /** the title slide's photo, echoed on the agenda sidebar and the closing slide */
  heroPhoto?: string;
  /** the uploaded institution logo, designed into this slide (title / closing) */
  logoAsset?: string;
  /** extra deck facts for title slides */
  deckType?: string;
  subject?: string;
}

export interface TemplateDef {
  id: string;
  family: string;
  when: string;
  /** slot description shown to the planner (with limits) */
  slots: string;
  photo: "required" | "optional" | "none";
  minItems?: number;
  maxItems?: number;
  render: (c: SlideContent, x: RenderCtx) => string;
  /** engine v6 only (not in the v5 catalog) */
  v6?: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pad2 = (n: number) => String(n).padStart(2, "0");
const ic = (name?: string, fallback = "sparkles") => `<i data-icon="${esc(name || fallback)}"></i>`;
const icbox = (name?: string, fallback?: string) => `<div class="v5-icbox">${ic(name, fallback)}</div>`;
const items = (c: SlideContent, max = 8) => (c.items || []).filter((i) => i && (i.title || i.text || i.value)).slice(0, max);
const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const QMARK = `<svg class="v5-qmark" viewBox="0 0 84 64" fill="currentColor"><path d="M0 64V38C0 16 11 3 33 0l3 9C24 13 18 21 17 32h16v32H0zm48 0V38c0-22 11-35 33-38l3 9c-12 4-18 12-19 23h16v32H48z"/></svg>`;

/** a hub's centre words when the plan gave none: the opening noun phrase of the title, whole words, no ellipsis */
export function coreLabel(t: string, max = 22): string {
  const words = String(t || "").replace(/\s*[:—–|-]\s.*$/, "").trim().split(/\s+/);
  let out = "";
  for (const w of words) { if ((out + " " + w).trim().length > max) break; out = (out + " " + w).trim(); }
  out = out.replace(/\s+(and|or|the|a|an|of|to|in|for|with|by|is|are|builds?|drives?|makes?|shapes?)$/i, "");
  return out || words[0] || "";
}

function shortTitle(t: string): string {
  const s = String(t || "").replace(/\s*[:—–|-]\s.*$/, "").trim();
  return s.length > 46 ? s.slice(0, 44).replace(/\s+\S*$/, "") + "…" : s;
}

/** background treatment per theme: strong on hero slides, quiet in the corners of content slides */
export function decor(t: Theme, mode: "hero" | "content"): string {
  const P = "var(--primary)", A = "var(--accent)", B = "var(--accent2)";
  const hero = mode === "hero";
  switch (t.decor) {
    case "orbs":
      return hero
        ? `<div class="v5-decor"><div style="width:640px;height:640px;right:-160px;top:-220px;border-radius:50%;background:${B};opacity:.35;filter:blur(90px)"></div><div style="width:520px;height:520px;left:-180px;bottom:-260px;border-radius:50%;background:${A};opacity:.28;filter:blur(90px)"></div><div style="inset:0;background-image:radial-gradient(color-mix(in srgb,#fff 16%,transparent) 1px,transparent 1.4px);background-size:34px 34px;opacity:.35;mask-image:linear-gradient(90deg,transparent 40%,#000 100%)"></div></div>`
        : `<div class="v5-decor"><div style="width:520px;height:520px;right:-260px;top:-300px;border-radius:50%;background:${B};opacity:.22;filter:blur(80px)"></div><div style="width:420px;height:420px;left:-240px;bottom:-300px;border-radius:50%;background:${A};opacity:.14;filter:blur(80px)"></div></div>`;
    case "grid":
      return hero
        ? `<div class="v5-decor"><div style="right:0;top:0;bottom:0;width:46%;background-image:linear-gradient(color-mix(in srgb,#fff 10%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,#fff 10%,transparent) 1px,transparent 1px);background-size:48px 48px"></div><div style="right:96px;bottom:96px;width:120px;height:120px;background:${A}"></div></div>`
        : `<div class="v5-decor"><div style="left:0;top:0;width:12px;height:150px;background:${A}"></div><div style="right:0;bottom:0;width:300px;height:220px;background-image:radial-gradient(color-mix(in srgb,var(--ink) 22%,transparent) 1.4px,transparent 1.6px);background-size:22px 22px;mask-image:linear-gradient(135deg,transparent 30%,#000 100%);opacity:.6"></div></div>`;
    case "arcs":
      return hero
        ? `<div class="v5-decor"><div style="right:-220px;bottom:-320px;width:760px;height:760px;border-radius:50%;border:2px solid color-mix(in srgb,#fff 28%,transparent)"></div><div style="right:-120px;bottom:-220px;width:560px;height:560px;border-radius:50%;border:2px solid color-mix(in srgb,#fff 22%,transparent)"></div><div style="right:-40px;bottom:-140px;width:400px;height:400px;border-radius:50%;background:${A};opacity:.92"></div></div>`
        : `<div class="v5-decor"><div style="right:-150px;top:-150px;width:300px;height:300px;border-radius:50%;border:40px solid ${P};opacity:.07"></div><div style="left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,${P} 0%,${P} 70%,${A} 70%,${A} 100%)"></div></div>`;
    case "blobs":
      return hero
        ? `<div class="v5-decor"><svg style="right:-120px;top:-80px;width:680px;height:680px;opacity:.9" viewBox="0 0 200 200"><path fill="color-mix(in srgb,${P} 22%,transparent)" d="M43.5,-60.3C55.2,-50.5,62.5,-35.7,66.8,-20.1C71.1,-4.5,72.4,11.9,66.3,25.2C60.2,38.5,46.7,48.7,32.1,56.3C17.5,63.9,1.9,68.9,-14.7,67.6C-31.3,66.3,-48.9,58.7,-59.5,45.3C-70.1,31.9,-73.7,12.7,-70.8,-4.9C-67.9,-22.5,-58.5,-38.5,-45.1,-48.5C-31.7,-58.5,-14.4,-62.5,1.6,-64.7C17.6,-66.9,31.8,-70.1,43.5,-60.3Z" transform="translate(100 100)"/></svg><svg style="left:-140px;bottom:-170px;width:460px;height:460px" viewBox="0 0 200 200"><path fill="color-mix(in srgb,${A} 26%,transparent)" d="M38.9,-51.6C49.6,-45.3,57,-33.2,62.2,-19.4C67.4,-5.6,70.3,9.9,64.9,21.9C59.5,33.9,45.8,42.3,32.1,50.4C18.4,58.5,4.7,66.2,-10.1,67.3C-24.9,68.4,-40.8,62.9,-51.7,52C-62.6,41.1,-68.5,24.8,-68.3,8.9C-68.1,-7,-61.8,-22.5,-51.4,-33.4C-41,-44.3,-26.5,-50.6,-12.5,-55.8C1.5,-61,28.2,-57.9,38.9,-51.6Z" transform="translate(100 100)"/></svg></div>`
        : `<div class="v5-decor"><svg style="right:-130px;top:-140px;width:340px;height:340px" viewBox="0 0 200 200"><path fill="color-mix(in srgb,${P} 10%,transparent)" d="M43.5,-60.3C55.2,-50.5,62.5,-35.7,66.8,-20.1C71.1,-4.5,72.4,11.9,66.3,25.2C60.2,38.5,46.7,48.7,32.1,56.3C17.5,63.9,1.9,68.9,-14.7,67.6C-31.3,66.3,-48.9,58.7,-59.5,45.3C-70.1,31.9,-73.7,12.7,-70.8,-4.9C-67.9,-22.5,-58.5,-38.5,-45.1,-48.5C-31.7,-58.5,-14.4,-62.5,1.6,-64.7C17.6,-66.9,31.8,-70.1,43.5,-60.3Z" transform="translate(100 100)"/></svg></div>`;
    case "rings":
      return hero
        ? `<div class="v5-decor"><div style="right:-200px;top:-200px;width:700px;height:700px;border-radius:50%;border:1.5px solid color-mix(in srgb,${A} 45%,transparent)"></div><div style="right:-120px;top:-120px;width:540px;height:540px;border-radius:50%;border:1.5px solid color-mix(in srgb,${A} 35%,transparent)"></div><div style="right:-40px;top:-40px;width:380px;height:380px;border-radius:50%;border:1.5px solid color-mix(in srgb,${A} 25%,transparent)"></div><div style="right:150px;top:300px;width:22px;height:22px;border-radius:50%;background:${A}"></div></div>`
        : `<div class="v5-decor"><div style="right:-170px;top:-170px;width:340px;height:340px;border-radius:50%;border:1.5px solid color-mix(in srgb,${P} 30%,transparent)"></div><div style="right:-110px;top:-110px;width:220px;height:220px;border-radius:50%;border:1.5px solid color-mix(in srgb,${P} 22%,transparent)"></div></div>`;
    case "lines":
      return hero
        ? `<div class="v5-decor"><div style="inset:26px;border:1.5px solid color-mix(in srgb,var(--ink) 30%,transparent)"></div><div style="inset:34px;border:1px solid color-mix(in srgb,var(--ink) 14%,transparent)"></div></div>`
        : `<div class="v5-decor"><div style="left:80px;right:80px;top:30px;height:1.5px;background:color-mix(in srgb,var(--ink) 22%,transparent)"></div><div style="left:80px;right:80px;bottom:46px;height:1px;background:color-mix(in srgb,var(--ink) 14%,transparent)"></div></div>`;
    case "mesh":
      return hero
        ? `<div class="v5-decor"><div style="right:90px;top:90px;width:260px;height:260px;border-radius:40px;transform:rotate(18deg);background:linear-gradient(135deg,${A},${B});opacity:.9"></div><div style="right:290px;top:310px;width:120px;height:120px;border-radius:28px;transform:rotate(-12deg);border:3px solid color-mix(in srgb,#fff 50%,transparent)"></div></div>`
        : `<div class="v5-decor"><div style="right:-220px;top:-260px;width:620px;height:520px;background:radial-gradient(closest-side,color-mix(in srgb,${P} 16%,transparent),transparent),radial-gradient(closest-side at 30% 70%,color-mix(in srgb,${B} 10%,transparent),transparent)"></div></div>`;
    case "dots":
      return hero
        ? `<div class="v5-decor"><div style="right:0;top:0;width:560px;height:720px;background-image:radial-gradient(color-mix(in srgb,${A} 70%,transparent) 2.2px,transparent 2.6px);background-size:30px 30px;mask-image:linear-gradient(115deg,transparent 25%,#000 85%);opacity:.75"></div><div style="right:120px;bottom:110px;width:150px;height:150px;border-radius:50%;background:${P};opacity:.9"></div></div>`
        : `<div class="v5-decor"><div style="right:0;top:0;width:260px;height:200px;background-image:radial-gradient(color-mix(in srgb,${P} 45%,transparent) 1.8px,transparent 2.2px);background-size:22px 22px;mask-image:linear-gradient(225deg,#000 10%,transparent 80%);opacity:.7"></div></div>`;
    case "waves":
      return hero
        ? `<div class="v5-decor"><svg style="left:0;right:0;bottom:0;width:1280px;height:300px" viewBox="0 0 1280 300" preserveAspectRatio="none"><path d="M0,190 C220,120 420,260 680,190 C900,130 1080,200 1280,150 L1280,300 L0,300 Z" fill="color-mix(in srgb,${A} 30%,transparent)"/><path d="M0,240 C260,190 470,290 720,240 C960,195 1120,250 1280,215 L1280,300 L0,300 Z" fill="color-mix(in srgb,${P} 45%,transparent)"/></svg></div>`
        : `<div class="v5-decor"><svg style="left:0;right:0;bottom:0;width:1280px;height:70px;opacity:.55" viewBox="0 0 1280 70" preserveAspectRatio="none"><path d="M0,40 C260,10 470,62 720,36 C960,12 1120,44 1280,26 L1280,70 L0,70 Z" fill="color-mix(in srgb,${P} 18%,transparent)"/></svg></div>`;
    case "corner":
      return hero
        ? `<div class="v5-decor"><div style="right:-180px;top:-180px;width:560px;height:560px;border-radius:50%;background:${A};opacity:.9"></div><div style="right:-60px;top:-60px;width:320px;height:320px;border-radius:50%;background:${P}"></div></div>`
        : `<div class="v5-decor"><div style="right:-90px;top:-90px;width:180px;height:180px;border-radius:50%;background:${A};opacity:.16"></div><div style="left:0;bottom:0;width:70px;height:6px;background:${A}"></div></div>`;
    case "diagonal":
      return hero
        ? `<div class="v5-decor"><div style="right:-120px;top:-40px;width:520px;height:820px;transform:rotate(14deg);background:repeating-linear-gradient(90deg,color-mix(in srgb,${A} 55%,transparent) 0 14px,transparent 14px 40px);opacity:.55"></div></div>`
        : `<div class="v5-decor"><div style="right:-40px;top:-30px;width:150px;height:140px;transform:rotate(14deg);background:repeating-linear-gradient(90deg,color-mix(in srgb,${P} 30%,transparent) 0 6px,transparent 6px 18px);opacity:.6"></div></div>`;
    case "band":
    default:
      return hero ? `<div class="v5-decor"><div style="left:0;top:0;bottom:0;width:18px;background:${A}"></div></div>` : `<div class="v5-decor"><div style="left:0;top:0;bottom:0;width:10px;background:${P}"></div></div>`;
  }
}

function head(c: SlideContent, x: RenderCtx, opts: { lede?: boolean } = {}): string {
  const eb = c.eyebrow || shortTitle(x.deckTitle);
  const lede = opts.lede !== false && c.lede ? `<p class="v5-lede">${esc(c.lede)}</p>` : "";
  return `<header class="v5-head"><div class="v5-eyebrow">${esc(eb)}</div><h2 class="v5-title" data-fit-title>${esc(c.title)}</h2>${lede}</header>`;
}

function foot(c: SlideContent, x: RenderCtx): string {
  const src = c.cites && c.cites.length ? `<div class="v5-src" data-v5-chrome>Sources: ${c.cites.slice(0, 6).map((k) => `[${k}]`).join(" ")}</div>` : "";
  return `<div class="v5-foot" data-v5-chrome><b>${pad2(x.n)}</b><span class="v5-dot"></span><span>${esc(shortTitle(x.deckTitle))}</span></div>${src}`;
}

function wrap(id: string, inner: string, c: SlideContent, x: RenderCtx, o: { hero?: boolean; cls?: string; noFoot?: boolean; decor?: boolean; maxS?: number } = {}): string {
  const heroDark = (() => { const h = (x.theme.heroInk || "#000").replace("#", ""); const v = parseInt(h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h, 16); return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114 > 140; })();
  const cls = ["v5", `tpl-${id}`, x.theme.dark || (o.hero && heroDark) ? "v5-dark" : "", x.logo ? "v5-has-logo" : "", o.hero ? "v5-hero v5-on-hero" : "", o.cls || ""].filter(Boolean).join(" ");
  const d = o.decor === false ? "" : decor(x.theme, o.hero ? "hero" : "content");
  return `<div class="${cls}" data-v5="${id}"${o.maxS ? ` data-max-s="${o.maxS}"` : ""} style="--s:1;--ts:1">${d}${inner}${o.noFoot ? "" : foot(c, x)}</div>`;
}

/** the icon composition used when a hero slide has no photo (topic icons from the deck) */
function artPanel(icons: string[], style = "right:70px;top:110px"): string {
  return `<div style="position:absolute;${style};width:420px;height:500px;z-index:1">
  <div style="position:absolute;left:40px;top:40px;width:340px;height:340px;border-radius:50%;background:linear-gradient(140deg,var(--primary),var(--accent2));opacity:.95"></div>
  <div style="position:absolute;left:115px;top:115px;width:190px;height:190px;color:var(--on-primary);display:flex;align-items:center;justify-content:center"><i data-icon="${esc(icons[0] || "sparkles")}" style="width:150px;height:150px;--ic-size:150px"></i></div>
  ${icons.slice(1, 3).map((n, k) => `<div class="v5-card" style="position:absolute;${k ? "right:0;bottom:30px" : "left:0;bottom:70px"};width:104px;height:104px;padding:0;align-items:center;justify-content:center;border-radius:28px;background:var(--surface);color:var(--primary)"><i data-icon="${esc(n)}" style="width:52px;height:52px"></i></div>`).join("")}
</div>`;
}

/** engine v6 title art without a photo: the deck's headline number on a colour block (data-led, like an
 *  editorial cover), or a calm geometric composition in the palette when the deck has no number */
function artPanelV6(x: RenderCtx): string {
  const st = x.heroStat;
  if (st?.value) {
    const v = esc(st.value).slice(0, 10);
    const big = v.length <= 4 ? 150 : v.length <= 6 ? 118 : 92;
    return `<div class="v6-cover" style="position:absolute;right:64px;top:64px;bottom:64px;width:420px;z-index:1;border-radius:calc(var(--radius) + 10px);background:var(--cover-bg,linear-gradient(160deg,var(--primary),color-mix(in srgb,var(--primary) 62%,#000)));color:var(--cover-ink,var(--on-primary));padding:46px 44px;display:flex;flex-direction:column;justify-content:flex-end;gap:16px;overflow:hidden">
  <div style="position:absolute;right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;border:34px solid var(--accent);opacity:.9"></div>
  <div style="position:absolute;right:70px;top:150px;width:70px;height:70px;border-radius:50%;background:var(--accent2)"></div>
  <b style="font-family:var(--font-heading);font-weight:800;font-size:${big}px;line-height:.95;letter-spacing:-.02em;position:relative">${v}</b>
  <span style="font-size:24px;line-height:1.3;font-weight:600;position:relative;max-width:330px">${esc(st.label).slice(0, 80)}</span>
</div>`;
  }
  // calm rings + one solid disc in the hero's own ink (white on dark heroes, the primary on light ones)
  return `<svg class="v6-art" viewBox="0 0 460 560" style="position:absolute;right:40px;top:80px;width:460px;height:560px;z-index:1;overflow:visible" aria-hidden="true">
  <circle cx="270" cy="270" r="230" fill="var(--art-ink)" fill-opacity=".06"/>
  <circle cx="270" cy="270" r="230" fill="none" stroke="var(--art-ink)" stroke-opacity=".32" stroke-width="2"/>
  <circle cx="270" cy="270" r="165" fill="none" stroke="var(--art-ink)" stroke-opacity=".22" stroke-width="2" stroke-dasharray="3 9"/>
  <circle cx="320" cy="330" r="112" fill="var(--hero-accent,var(--accent))"/>
  <circle cx="170" cy="170" r="30" fill="var(--art-ink)" fill-opacity=".85"/>
  <circle cx="410" cy="120" r="9" fill="var(--hero-accent,var(--accent))"/>
</svg>`;
}

function logoEl(x: RenderCtx): string {
  return x.logoAsset ? `<div class="v5-logo"><img src="asset:${esc(x.logoAsset)}" alt="Institution logo"></div>` : "";
}

function people(x: RenderCtx, max = 6): string {
  const f = x.fields.filter((f) => f.value).slice(0, max);
  if (!f.length) return "";
  const three = f.length >= 5;
  return `<div class="v5-people${three ? " v5-people-3" : ""}">${f.map((p) => `<div class="v5-person"><span>${esc(p.label)}</span><b>${esc(p.value)}</b></div>`).join("")}</div>`;
}

function photo(c: SlideContent, cls = "v5-photo", style = ""): string {
  if (!c.photo) return "";
  const pos = c.photoFocus && /^(top|center|bottom|left|right|\d{1,3}% \d{1,3}%)$/.test(c.photoFocus) ? `;object-position:${c.photoFocus}` : "";
  return `<div class="${cls}"${style ? ` style="${style}"` : ""}><img src="asset:${esc(c.photo)}" alt="${esc(c.photoQuery || c.title)}" style="${pos.slice(1)}"></div>`;
}

function figure(kind: string, list: SlotItem[], attrs = "", style = "position:relative;width:100%;height:100%"): string {
  const lis = list.map((it) => {
    const a: string[] = [];
    if (it.value != null && it.value !== "" && Number.isFinite(parseFloat(String(it.value)))) a.push(`data-value="${esc(parseFloat(String(it.value)))}"`);
    const icon = it.icon ? `<i class="ic" data-icon="${esc(it.icon)}"></i>` : "";
    const t = it.title || it.label || "";
    return `<li${a.length ? " " + a.join(" ") : ""}>${icon}${t ? `<strong>${esc(t)}</strong>` : ""}${it.text ? ` ${esc(it.text)}` : ""}</li>`;
  });
  const size = /data-size=/.test(attrs) ? "" : ` data-size="${kind === "bars" || kind === "line" || kind === "donut" ? 24 : 27}"`;
  return `<figure class="v3-diagram" data-kind="${kind}"${size}${attrs ? " " + attrs : ""} style="${style}">${lis.join("")}</figure>`;
}

// ── templates ─────────────────────────────────────────────────────────────
export const TEMPLATES: TemplateDef[] = [
  {
    id: "title-hero", family: "title", photo: "required",
    when: "Opening slide with a strong, relevant photo (landscape, place, phenomenon).",
    slots: `title (≤ 60 chars), lede = subtitle (≤ 90 chars), photo_query`,
    render: (c, x) => wrap("title-hero", `<div class="v5-bgimg">${c.photo ? `<img src="asset:${esc(c.photo)}" alt="">` : ""}</div>
<div class="v5-scrim" style="background:linear-gradient(90deg,var(--bg) 0%,color-mix(in srgb,var(--bg) 96%,transparent) 42%,color-mix(in srgb,var(--bg) 72%,transparent) 62%,transparent 90%)"></div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:26px;max-width:700px" data-fit-box>
  ${logoEl(x)}<div class="v5-eyebrow">${esc(c.eyebrow || x.deckType || "Presentation")}</div>
  <h1 class="v5-hero-title" data-fit-title>${esc(c.title)}</h1>
  ${c.lede ? `<p class="v5-hero-sub">${esc(c.lede)}</p>` : ""}
  <div style="width:90px;height:5px;border-radius:3px;background:var(--accent)"></div>
  ${people(x)}
</div>`, c, x, { noFoot: true, decor: false, cls: x.theme.dark ? "" : "" }),
  },
  {
    id: "title-split", family: "title", photo: "optional",
    when: "Opening slide; photo on the right if there is a good one, otherwise an icon composition.",
    slots: `title (≤ 60 chars), lede = subtitle (≤ 90 chars), items = 3 icon concepts [{icon}] for the art panel, photo_query (optional)`,
    render: (c, x) => {
      const icons = [...(c.items || []).map((i) => i && i.icon), ...(x.deckIcons || [])].filter((v) => v && !/(^|:)(info|circle|help-circle|circle-help|question|check|x|star|sparkles)$/.test(String(v))).filter((v, k, a) => a.indexOf(v) === k).slice(0, 3) as string[];
      const art = c.photo
        ? `<div class="v5-photo" style="position:absolute;right:56px;top:56px;bottom:56px;width:430px;border-radius:calc(var(--radius) + 8px);z-index:1">${`<img src="asset:${esc(c.photo)}" alt="">`}</div>`
        : x.theme.v6 ? artPanelV6(x) : artPanel(icons);
      return wrap("title-split", `${art}<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;max-width:650px" data-fit-box>
  ${logoEl(x)}<div class="v5-eyebrow">${esc(c.eyebrow || x.deckType || "Presentation")}</div>
  <h1 class="v5-hero-title" data-fit-title>${esc(c.title)}</h1>
  ${c.lede ? `<p class="v5-hero-sub">${esc(c.lede)}</p>` : ""}
  ${people(x)}
</div>`, c, x, { hero: true, noFoot: true });
    },
  },
  {
    id: "title-type", family: "title", photo: "none",
    when: "Opening slide, typographic (no photo).",
    slots: `title (≤ 60 chars), lede = subtitle (≤ 90 chars)`,
    render: (c, x) => wrap("title-type", `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:26px;max-width:960px;padding-bottom:14px" data-fit-box>
  ${logoEl(x)}<div class="v5-eyebrow">${esc(c.eyebrow || x.deckType || "Presentation")}</div>
  <h1 class="v5-hero-title" data-fit-title style="font-size:calc(var(--ts) * 84px)">${esc(c.title)}</h1>
  ${c.lede ? `<p class="v5-hero-sub">${esc(c.lede)}</p>` : ""}
</div>
${people(x) ? `<div style="flex:none;border-top:1.5px solid color-mix(in srgb,var(--ink) 25%,transparent);padding-top:24px;margin-top:18px">${people(x)}</div>` : ""}`, c, x, { hero: true, noFoot: true }),
  },
  {
    id: "agenda", family: "agenda", photo: "none", minItems: 3, maxItems: 6,
    when: "Agenda / contents / outline of the talk.",
    slots: `title (e.g. "Agenda"), items 3–6 [{title ≤ 40 chars, text ≤ 70 chars optional}]`,
    render: (c, x) => {
      const its = items(c, 6);
      const hi = x.language === "Hindi";
      // without a photo the sidebar carries the deck's question (the part after the colon) and the parts' icons,
      // so it never stands as an empty coloured block
      const q = String(x.deckTitle || "").split(/[:：—–]\s+/).slice(1).join(": ").trim();
      const lede = c.lede || (!x.heroPhoto ? (q && q.length >= 12 ? q : x.deckTitle !== c.title ? x.deckTitle : "") : "");
      return wrap("agenda", `<div style="display:flex;gap:64px;flex:1;min-height:0">
  <div class="v5-panel v5-panel-primary" style="flex:0 0 400px;margin:-58px 0 -56px -80px;padding:64px 44px 60px 80px;border-radius:0;justify-content:space-between;position:relative;overflow:hidden">
    ${x.heroPhoto ? `<img src="asset:${esc(x.heroPhoto)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0"><div style="position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--primary) 90%,transparent) 0%,color-mix(in srgb,var(--primary) 62%,transparent) 100%);z-index:0"></div>` : ""}
    <div style="display:flex;flex-direction:column;gap:16px;position:relative;z-index:1"><div class="v5-eyebrow" style="color:var(--on-primary);opacity:.9">${esc(c.eyebrow || shortTitle(x.deckTitle))}</div><h2 class="v5-title" data-fit-title style="font-size:calc(var(--ts) * 60px);color:var(--on-primary)">${esc(c.title)}</h2>${lede ? `<p class="v5-lede" style="color:var(--on-primary);opacity:.9;font-size:max(22px,calc(var(--s) * 22px));line-height:1.35">${esc(lede)}</p>` : ""}</div>
    ${x.heroPhoto ? `<div style="color:var(--on-primary);opacity:.9;position:relative;z-index:1"><i data-icon="${esc(its[0]?.icon || "list-checks")}" style="width:84px;height:84px"></i></div>` : `<div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:18px">
      <div style="display:grid;grid-template-columns:repeat(${Math.min(its.length, 4) > 2 ? 2 : Math.max(1, Math.min(its.length, 2))},76px);gap:14px">${its.slice(0, 4).map((it) => `<div style="width:76px;height:76px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--on-primary) 16%,transparent);color:var(--on-primary)"><i data-icon="${esc(it.icon || "circle-dot")}" style="width:40px;height:40px"></i></div>`).join("")}</div>
      <p style="margin:0;color:var(--on-primary);opacity:.85;font-size:20px;font-weight:600;letter-spacing:.04em">${hi ? `${its.length} भाग · ${x.total} स्लाइड` : `${its.length} parts · ${x.total} slides`}</p>
    </div>`}
  </div>
  <div class="v5-rows" data-fit-box style="padding:6px 0">${its.map((it, k) => `<div class="v5-row"><div class="v5-bignum" style="font-size:max(30px,calc(var(--s) * 40px));width:calc(var(--s) * 70px)">${pad2(k + 1)}</div><div class="v5-row-txt"><h3 class="v5-h3">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div></div>`).join("")}</div>
</div>`, c, x, { decor: false, noFoot: true, maxS: 1.25 });
    },
  },
  {
    id: "section", family: "section", photo: "none",
    when: "Divider between major parts of a long deck (≥ 10 slides only).",
    slots: `title (≤ 40 chars), lede (≤ 100 chars), eyebrow = "Part 2" style label`,
    render: (c, x) => wrap("section", `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;max-width:860px" data-fit-box>
  <div class="v5-eyebrow">${esc(c.eyebrow || "Section")}</div>
  <h2 class="v5-hero-title" data-fit-title style="font-size:calc(var(--ts) * 76px)">${esc(c.title)}</h2>
  ${c.lede ? `<p class="v5-hero-sub">${esc(c.lede)}</p>` : ""}
</div>`, c, x, { hero: true }),
  },
  {
    id: "big-stat", family: "stat", photo: "none",
    when: "One striking number is the message (a percentage, a year, a count) + up to 2 supporting numbers.",
    slots: `title (action title ≤ 70 chars), stat {value ≤ 8 chars e.g. "71%", label ≤ 50 chars, text ≤ 160 chars}, items 0–2 [{value ≤ 8 chars, label ≤ 50 chars}] supporting numbers, icon on stat via items? no`,
    render: (c, x) => {
      const st = c.stat || { value: items(c)[0]?.value || "", label: items(c)[0]?.label || "" };
      const minis = items(c, 2).filter((i) => i.value && i.value !== st.value);
      if (!minis.length) {
        // one number alone: a full-width band — the number on a strong panel, its meaning beside it (no half-empty slide)
        const icon = items(c)[0]?.icon || (x.deckIcons || [])[0];
        return wrap("big-stat", `${head(c, x, { lede: false })}<div class="v5-body" style="align-items:stretch">
  <div class="v5-panel v5-panel-primary" style="flex:0 0 46%;justify-content:center;align-items:flex-start;gap:14px;position:relative;overflow:hidden">
    ${icon ? `<div style="position:absolute;inset:0;overflow:hidden;border-radius:inherit"><span style="position:absolute;right:-30px;bottom:-40px;opacity:.16;color:var(--on-strong);display:flex"><i data-icon="${esc(icon)}" style="width:260px;height:260px"></i></span></div>` : ""}
    <p class="v5-statval" style="position:relative;color:var(--on-strong);font-size:${String(st.value).length > 5 ? Math.max(64, Math.floor(470 / (String(st.value).length * 0.68))) : 160}px;white-space:nowrap">${esc(st.value)}</p>
    <div style="position:relative;width:80px;height:6px;border-radius:3px;background:var(--accent)"></div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:calc(var(--s) * 20px);min-width:0" data-fit-box>
    <p class="v5-statlabel" style="font-size:max(26px,calc(var(--s) * 36px));line-height:1.2">${esc(st.label)}</p>
    ${st.text || c.lede ? `<p class="v5-p" style="color:var(--ink);opacity:.85;font-size:max(20px,calc(var(--s) * 22px))">${esc(st.text || c.lede)}</p>` : ""}
  </div>
</div>`, c, x);
      }
      return wrap("big-stat", `${head(c, x, { lede: false })}<div class="v5-body">
  <div class="v5-panel v5-panel-soft" style="flex:1.35;justify-content:center;gap:calc(var(--s) * 18px)" data-fit-box>
    <p class="v5-statval" style="font-size:${String(st.value).length > 6 ? Math.max(64, Math.floor(620 / (String(st.value).length * 0.68))) : 150}px;white-space:nowrap">${esc(st.value)}</p>
    <p class="v5-statlabel" style="font-size:max(24px,calc(var(--s) * 32px))">${esc(st.label)}</p>
    ${st.text || c.lede ? `<p class="v5-p" style="color:var(--ink);opacity:.82">${esc(st.text || c.lede)}</p>` : ""}
  </div>
  ${minis.length ? `<div style="flex:1;display:flex;flex-direction:column;gap:var(--gap);min-width:0">${minis.map((m) => `<div class="v5-card v5-accent-top" style="flex:1;justify-content:center" data-fit-box><p class="v5-statval" style="font-size:${String(m.value).length > 6 ? Math.max(30, Math.floor(330 / (String(m.value).length * 0.62))) : 56}px;white-space:nowrap">${esc(m.value)}</p><p class="v5-p" style="color:var(--ink)">${esc(m.label || m.title || m.text)}</p></div>`).join("")}</div>` : ""}
</div>`, c, x);
    },
  },
  {
    id: "stats-row", family: "stat", photo: "none", minItems: 3, maxItems: 4,
    when: "3–4 key numbers side by side (facts with real figures).",
    slots: `title (≤ 70 chars), lede (≤ 120 chars optional), items 3–4 [{value ≤ 8 chars, label ≤ 36 chars, text ≤ 90 chars, icon}]`,
    render: (c, x) => {
      const its = items(c, 4);
      // one value size for the row, from the longest value and the column width (values never wrap or spill)
      const longest = Math.max(1, ...its.map((it) => String(it.value || "").length));
      const colW = (1120 - (its.length - 1) * 24) / Math.max(1, its.length) - 56;
      const vpx = Math.max(34, Math.min(76, Math.floor(colW / (longest * 0.68))));
      return wrap("stats-row", `${head(c, x)}<div class="v5-body"><div class="v5-grid v5-cols-${its.length}">${its.map((it) => `<div class="v5-card v5-accent-top" data-fit-box style="justify-content:flex-start">
  ${it.icon ? `<div style="color:var(--primary);height:calc(var(--s) * 40px)"><i data-icon="${esc(it.icon)}" style="width:calc(var(--s) * 40px);height:calc(var(--s) * 40px)"></i></div>` : ""}
  <p class="v5-statval" style="font-size:${vpx}px;white-space:nowrap">${esc(it.value)}</p>
  <h3 class="v5-h3">${esc(it.label || it.title)}</h3>
  ${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}
</div>`).join("")}</div></div>`, c, x);
    },
  },
  {
    id: "cards-3", family: "cards", photo: "none", minItems: 3, maxItems: 3,
    when: "Three parallel ideas (types, causes, features, benefits) each with an icon.",
    slots: `title (≤ 70 chars), lede (≤ 120 chars optional), items exactly 3 [{icon, title ≤ 32 chars, text ≤ 130 chars}]`,
    render: (c, x) => {
      const its = items(c, 3);
      return wrap("cards-3", `${head(c, x)}<div class="v5-body"><div class="v5-grid v5-cols-${its.length}">${its.map((it, k) => `<div class="v5-card" data-fit-box>${icbox(it.icon)}<span class="v5-num v5-cardnum">${pad2(k + 1)}</span><h3 class="v5-h3">${esc(it.title)}</h3><p class="v5-p">${esc(it.text)}</p></div>`).join("")}</div></div>`, c, x);
    },
  },
  {
    id: "cards-4", family: "cards", photo: "none", minItems: 4, maxItems: 4,
    when: "Four parallel ideas with icons.",
    slots: `title (≤ 70 chars), lede (optional), items exactly 4 [{icon, title ≤ 30 chars, text ≤ 110 chars}]`,
    render: (c, x) => {
      const its = items(c, 4);
      const long = its.reduce((a, i) => a + (i.text || "").length, 0) / Math.max(1, its.length) > 55;
      return wrap("cards-4", `${head(c, x)}<div class="v5-body"><div class="v5-grid ${long ? "v5-cols-2" : "v5-cols-4"}">${its.map((it) => long
        ? `<div class="v5-card" data-fit-box style="flex-direction:row;align-items:flex-start;gap:calc(var(--s) * 22px)">${icbox(it.icon)}<div style="display:flex;flex-direction:column;gap:8px;min-width:0"><h3 class="v5-h3">${esc(it.title)}</h3><p class="v5-p">${esc(it.text)}</p></div></div>`
        : `<div class="v5-card" data-fit-box>${icbox(it.icon)}<h3 class="v5-h3">${esc(it.title)}</h3><p class="v5-p">${esc(it.text)}</p></div>`).join("")}</div></div>`, c, x);
    },
  },
  {
    id: "cards-2", family: "cards", photo: "none", minItems: 2, maxItems: 2,
    when: "Two big ideas side by side (two types, two parts, problem/solution), each with 2–3 points.",
    slots: `title (≤ 70 chars), lede (optional), items exactly 2 [{icon, title ≤ 34 chars, text ≤ 160 chars}]`,
    render: (c, x) => {
      const its = items(c, 2);
      return wrap("cards-2", `${head(c, x)}<div class="v5-body"><div class="v5-grid v5-cols-2">${its.map((it, k) => `<div class="v5-card" data-fit-box style="${k === 1 ? "" : ""}"><div style="display:flex;align-items:center;gap:calc(var(--s) * 20px)">${icbox(it.icon)}<h3 class="v5-h3" style="font-size:max(24px,calc(var(--s) * 32px))">${esc(it.title)}</h3></div><p class="v5-p" style="font-size:max(20px,calc(var(--s) * 24px))">${esc(it.text)}</p></div>`).join("")}</div></div>`, c, x);
    },
  },
  {
    id: "icon-rows-photo", family: "list", photo: "required", minItems: 3, maxItems: 4,
    when: "3–4 points with icons beside a relevant photo.",
    slots: `title (≤ 70 chars), items 3–4 [{icon, title ≤ 34 chars, text ≤ 110 chars}], photo_query`,
    render: (c, x) => {
      const its = items(c, 4);
      return wrap("icon-rows-photo", `${head(c, x)}<div class="v5-body">
  <div class="v5-rows" data-fit-box style="flex:1.25">${its.map((it) => `<div class="v5-row">${icbox(it.icon)}<div class="v5-row-txt"><h3 class="v5-h3">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div></div>`).join("")}</div>
  ${photo(c, "v5-photo", "flex:1")}
</div>`, c, x);
    },
  },
  {
    id: "photo-split", family: "photo", photo: "required", minItems: 2, maxItems: 4,
    when: "A concept explained next to a big relevant photo (full-height on the right).",
    slots: `title (≤ 60 chars), lede (≤ 120 chars), items 2–4 [{text ≤ 110 chars}] bullet points, photo_query`,
    render: (c, x) => wrap("photo-split", `<div class="v5-photo-side"><img src="asset:${esc(c.photo || "")}" alt=""></div>${head(c, x)}<div class="v5-body" style="flex-direction:column" data-fit-box>
  <ul class="v5-bullets">${items(c, 4).map((it) => `<li><span>${it.title ? `<b style="color:var(--ink)">${esc(it.title)}${it.text ? ": " : ""}</b>` : ""}${esc(it.text)}</span></li>`).join("")}</ul>
</div>`, c, x, { cls: "v5-split-right" }),
  },
  {
    id: "photo-full", family: "photo", photo: "required",
    when: "A striking image IS the message (a place, an event, a phenomenon) with one sentence.",
    slots: `title (≤ 60 chars), lede (≤ 140 chars), photo_query`,
    render: (c, x) => wrap("photo-full", `<div class="v5-bgimg"><img src="asset:${esc(c.photo || "")}" alt=""></div>
<div class="v5-scrim" style="background:linear-gradient(0deg,rgba(6,8,16,.9) 0%,rgba(6,8,16,.62) 42%,rgba(6,8,16,0) 72%)"></div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:16px;max-width:900px;padding-bottom:22px;--ink:#ffffff;--muted:#e2e6f0" data-fit-box>
  <div class="v5-eyebrow" style="color:#fff">${esc(c.eyebrow || shortTitle(x.deckTitle))}</div>
  <h2 class="v5-title" data-fit-title style="color:#fff;font-size:calc(var(--ts) * 56px)">${esc(c.title)}</h2>
  ${c.lede ? `<p class="v5-lede" style="color:#eef1f7">${esc(c.lede)}</p>` : ""}
</div>`, c, x, { decor: false, cls: "v5-dark" }),
  },
  {
    id: "timeline", family: "timeline", photo: "none", minItems: 3, maxItems: 6,
    when: "Events in time order (history, milestones, discoveries) with dates.",
    slots: `title (≤ 70 chars), items 3–6 in order [{label = date/year ≤ 12 chars, title ≤ 30 chars, text ≤ 90 chars}]`,
    render: (c, x) => {
      const its = items(c, 6);
      const n = its.length;
      return wrap("timeline", `${head(c, x)}<div class="v5-body"><div class="v5-tl">
  <div class="v5-tl-line">${its.map((_, k) => `<span class="v5-tl-dot" style="left:calc(${((k + 0.5) / n) * 100}% - 12px - ${(14 * (k + 0.5)) / n}px)"></span>`).join("")}</div>
  <div class="v5-tl-cols" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${its.map((it) => `<div class="v5-tl-item v5-card" data-fit-box><div class="v5-tl-date">${esc(it.label || it.value || "")}</div><h3 class="v5-h3">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div>`).join("")}</div>
</div></div>`, c, x);
    },
  },
  {
    id: "process", family: "process", photo: "none", minItems: 3, maxItems: 5,
    when: "Steps of a method / how something works, in order.",
    slots: `title (≤ 70 chars), lede (optional), items 3–5 in order [{icon, title ≤ 26 chars, text ≤ 90 chars}]`,
    render: (c, x) => {
      const its = items(c, 5);
      const avg = its.reduce((a, it) => a + (it.text || "").length, 0) / Math.max(1, its.length);
      if (its.length >= 5 || (its.length === 4 && avg > 75)) {
        // many or wordy steps: a vertical stepper reads better than narrow columns
        return wrap("process", `${head(c, x)}<div class="v5-body"><div class="v5-rows v5-steps" data-fit-box>${its.map((it, k) => `<div class="v5-row"><div class="v5-badge" style="flex:none;width:calc(var(--s) * 40px);height:calc(var(--s) * 40px);font-size:max(18px,calc(var(--s) * 19px))">${k + 1}</div>${it.icon ? `<span style="flex:none;color:var(--primary);display:flex"><i data-icon="${esc(it.icon)}" style="width:calc(var(--s) * 30px);height:calc(var(--s) * 30px)"></i></span>` : ""}<div class="v5-row-txt" style="flex:1 1 0;min-width:0;display:grid;grid-template-columns:minmax(0,34%) minmax(0,1fr);align-items:center;gap:24px"><h3 class="v5-h3" style="font-size:max(20px,calc(var(--s) * 21px));line-height:1.2">${esc(it.title)}</h3>${it.text ? `<p class="v5-p" style="font-size:max(19px,calc(var(--s) * 17px));line-height:1.35">${esc(it.text)}</p>` : ""}</div></div>`).join("")}</div></div>`, c, x);
      }
      return wrap("process", `${head(c, x)}<div class="v5-body"><div class="v5-proc">${its.map((it, k) => `${k ? `<div class="v5-arrow">${ARROW}</div>` : ""}<div class="v5-card" data-fit-box><div style="display:flex;align-items:center;justify-content:space-between"><div class="v5-badge">${k + 1}</div><div style="color:var(--primary)">${it.icon ? `<i data-icon="${esc(it.icon)}" style="width:calc(var(--s) * 40px);height:calc(var(--s) * 40px)"></i>` : ""}</div></div><h3 class="v5-h3">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div>`).join("")}</div></div>`, c, x);
    },
  },
  {
    id: "cycle", family: "diagram", photo: "none", minItems: 3, maxItems: 6,
    when: "A repeating loop (life cycle, water cycle, feedback loop).",
    slots: `title (≤ 70 chars), lede (≤ 140 chars: what the loop shows), center (≤ 18 chars, the loop's name), items 3–6 in loop order [{icon, title ≤ 20 chars, text ≤ 60 chars optional}]`,
    render: (c, x) => {
      const its = items(c, 6);
      const n = Math.max(1, its.length);
      const ang = (k: number) => -90 + (360 / n) * k;
      const cw = n > 4 ? 226 : n === 3 ? 310 : 252, chh = n > 4 ? 116 : n === 3 ? 172 : 128;
      const pos = (deg: number, dx: number, dy: number) => `left:calc(50% + cos(${deg}deg) * (50% - ${dx}px));top:calc(50% + sin(${deg}deg) * (50% - ${dy}px))`;
      const nodes = its.map((it, k) => `<div class="v5-card v5-cyc-node" data-fit-box data-fit-pos style="${pos(ang(k), cw / 2, chh / 2)};width:${cw}px;height:${chh}px">${it.icon ? `<span class="v5-cyc-ic"><i data-icon="${esc(it.icon)}" style="width:26px;height:26px"></i></span>` : ""}<div style="display:flex;align-items:center;gap:10px;padding-right:${it.icon ? 30 : 0}px"><span class="v5-badge" style="width:30px;height:30px;font-size:17px">${k + 1}</span><h3 class="v5-h3" style="font-size:max(20px,calc(var(--s) * 22px));line-height:1.1">${esc(it.title)}</h3></div>${it.text ? `<p class="v5-p" style="font-size:max(18px,calc(var(--s) * 18px));line-height:1.25">${esc(it.text)}</p>` : ""}</div>`).join("");
      const arrows = its.map((_, k) => { const m = ang(k) + 180 / n; return `<div class="v5-cyc-arrow" style="${pos(m, cw / 2, chh / 2)};transform:translate(-50%,-50%) rotate(${m + 90}deg)"></div>`; }).join("");
      return wrap("cycle", `${head(c, x, { lede: false })}<div class="v5-body">
  <div style="flex:0 0 300px;display:flex;flex-direction:column;justify-content:center;gap:22px" data-fit-box>
    ${c.lede ? `<p class="v5-statement" style="font-size:max(22px,calc(var(--s) * 28px))">${esc(c.lede)}</p>` : ""}
    <div class="v5-chip">${ic("refresh-cw")}<span>${x.language === "Hindi" ? `${its.length} चरण, बार-बार` : `${its.length} stages, repeating`}</span></div>
  </div>
  <div class="v5-cyc" style="flex:1;min-width:0">
    <div class="v5-cyc-ring" style="left:${cw / 2}px;right:${cw / 2}px;top:${chh / 2}px;bottom:${chh / 2}px"></div>
    ${arrows}
    ${n === 3 ? "" : `<div class="v5-cyc-core"><i data-icon="lucide:refresh-cw" style="width:44px;height:44px"></i>${c.center ? `<span>${esc(c.center)}</span>` : ""}</div>`}
    ${nodes}
  </div>
</div>`, c, x);
    },
  },
  {
    id: "hub", family: "diagram", photo: "none", minItems: 3, maxItems: 6,
    when: "One central idea with 3–6 connected parts/factors/components.",
    slots: `title (≤ 70 chars), center (≤ 22 chars), items 3–6 [{icon, title ≤ 24 chars, text ≤ 70 chars}]`,
    render: (c, x) => {
      const its = items(c, 6);
      const k = Math.ceil(its.length / 2);
      const L = its.slice(0, k), R = its.slice(k);
      const card = (it: SlotItem, side: "l" | "r") => `<div class="v5-card v5-hub-card v5-hub-${side}" data-fit-box style="flex-direction:row;align-items:center;gap:calc(var(--s) * 18px);padding:calc(var(--s) * 18px) calc(var(--s) * 22px)">${icbox(it.icon)}<div style="display:flex;flex-direction:column;gap:4px;min-width:0"><h3 class="v5-h3" style="font-size:max(21px,calc(var(--s) * 24px))">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div></div>`;
      const col = (arr: SlotItem[], side: "l" | "r") => `<div class="v5-hub-col v5-hub-col-${side}${arr.length === 1 ? " v5-hub-one" : ""}" style="--n:${arr.length}">${arr.map((it) => card(it, side)).join("")}</div>`;
      return wrap("hub", `${head(c, x)}<div class="v5-body"><div class="v5-hub">${col(L, "l")}<div class="v5-hub-mid"><div class="v5-hub-core"><span>${esc(c.center || coreLabel(c.title))}</span></div></div>${R.length ? col(R, "r") : "<div></div>"}</div></div>`, c, x);
    },
  },
  {
    id: "layers", family: "diagram", photo: "none", minItems: 3, maxItems: 5,
    when: "A hierarchy or levels (pyramid: base to top, layers of a model/system).",
    slots: `title (≤ 70 chars), items 3–5 from TOP to BASE [{title ≤ 22 chars, text ≤ 100 chars}]`,
    render: (c, x) => {
      const its = items(c, 5);
      const n = its.length;
      return wrap("layers", `${head(c, x)}<div class="v5-body" style="flex-direction:column;gap:calc(var(--s) * 12px)" data-fit-box>${its.map((it, k) => {
        const w = 34 + (k * 30) / Math.max(1, n - 1);
        const mix = 100 - k * (50 / Math.max(1, n - 1));
        return `<div class="v5-layer"><div style="flex:0 0 46%;display:flex;justify-content:center;height:100%"><div class="v5-layer-shape" style="width:${w * 2}%;max-width:100%;background:color-mix(in srgb,var(--primary) ${mix}%,var(--accent2))">${esc(it.title)}</div></div><p class="v5-p" style="flex:1;color:var(--ink)">${esc(it.text)}</p></div>`;
      }).join("")}</div>`, c, x);
    },
  },
  {
    id: "comparison", family: "compare", photo: "none",
    when: "Two things compared (A vs B, before/after, old vs new).",
    slots: `title (≤ 70 chars), left {title ≤ 26 chars, icon, points 3–4 × ≤ 80 chars}, right {same}`,
    render: (c, x) => {
      const side = (s: Side | undefined, k: number) => `<div class="v5-card" data-fit-box style="gap:calc(var(--s) * 18px)"><div class="v5-cmp-head">${icbox(s?.icon, k ? "circle-dot" : "circle")}<h3 class="v5-h3" style="font-size:max(24px,calc(var(--s) * 32px))">${esc(s?.title)}</h3></div><ul class="v5-bullets v5-checks">${(s?.points || []).slice(0, 5).map((p) => `<li><span class="v5-mark v5-mark-p">${ic("check")}</span><span>${esc(p)}</span></li>`).join("")}</ul></div>`;
      return wrap("comparison", `${head(c, x)}<div class="v5-body"><div class="v5-grid v5-cols-2" style="position:relative;gap:64px">${side(c.left, 0)}${side(c.right, 1)}<div class="v5-vs">VS</div></div></div>`, c, x);
    },
  },
  {
    id: "pros-cons", family: "compare", photo: "none",
    when: "Advantages vs disadvantages, benefits vs risks, opportunities vs challenges.",
    slots: `title (≤ 70 chars), left {title e.g. "Advantages", points 3–4 × ≤ 80 chars}, right {title e.g. "Challenges", points 3–4 × ≤ 80 chars}`,
    render: (c, x) => {
      const side = (s: Side | undefined, ok: boolean) => `<div class="v5-card" data-fit-box style="gap:calc(var(--s) * 18px);border-top:5px solid ${ok ? "#16a34a" : "#dc2626"}"><div style="display:flex;align-items:center;gap:16px"><span class="v5-mark ${ok ? "v5-mark-ok" : "v5-mark-no"}" style="width:calc(var(--s) * 52px);height:calc(var(--s) * 52px)">${ic(ok ? "thumbs-up" : "thumbs-down")}</span><h3 class="v5-h3" style="font-size:max(24px,calc(var(--s) * 32px))">${esc(s?.title || (ok ? "Advantages" : "Challenges"))}</h3></div><ul class="v5-bullets v5-checks">${(s?.points || []).slice(0, 5).map((p) => `<li><span class="v5-mark ${ok ? "v5-mark-ok" : "v5-mark-no"}">${ic(ok ? "check" : "x")}</span><span>${esc(p)}</span></li>`).join("")}</ul></div>`;
      return wrap("pros-cons", `${head(c, x)}<div class="v5-body"><div class="v5-grid v5-cols-2">${side(c.left, true)}${side(c.right, false)}</div></div>`, c, x);
    },
  },
  {
    id: "quote", family: "quote", photo: "optional",
    when: "A real, sourced quotation from a named person that sums up the idea.",
    slots: `title (short context ≤ 50 chars), quote {text ≤ 200 chars, author, role ≤ 60 chars}, photo_query = the person's name (optional)`,
    render: (c, x) => {
      const q = c.quote || { text: c.lede || "" };
      return wrap("quote", `<div style="flex:1;display:flex;align-items:center;gap:70px;min-height:0">
  ${c.photo ? `<div class="v5-photo" style="flex:0 0 340px;height:420px;border-radius:calc(var(--radius) + 10px)"><img src="asset:${esc(c.photo)}" alt="" style="object-position:center 25%"></div>` : ""}
  <div style="flex:1;display:flex;flex-direction:column;gap:28px;min-width:0;${c.photo ? "" : "max-width:1000px;margin:0 auto;align-items:center;text-align:center"}" data-fit-box>
    <div class="v5-eyebrow">${esc(c.title || c.eyebrow || "In their words")}</div>
    ${QMARK}
    <p class="v5-quote" data-fit-title style="${c.photo ? "" : "font-size:calc(var(--ts) * 56px)"}">${esc(q.text)}</p>
    ${q.author ? `<div style="display:flex;align-items:center;gap:16px"><div style="width:46px;height:3px;background:var(--accent)"></div><div><b style="font-size:max(20px,calc(var(--s) * 24px));color:var(--ink)">${esc(q.author)}</b>${q.role ? `<p class="v5-p" style="font-size:20px">${esc(q.role)}</p>` : ""}</div></div>` : ""}
  </div>
</div>`, c, x);
    },
  },
  {
    id: "chart", family: "data", photo: "none",
    when: "Real numbers from the research that compare categories or show a trend (only real data!).",
    slots: `title (action title ≤ 70 chars), chart {kind bars|line|donut, unit, items 3–8 [{label ≤ 16 chars, value number}]}, takeaway (≤ 120 chars insight), stat {value, label} optional highlight`,
    render: (c, x) => {
      const ch = c.chart || { kind: "bars", items: [] };
      const list: SlotItem[] = ch.items.slice(0, 8).map((i) => ({ title: i.label, value: String(i.value) }));
      const unit = ch.unit ? ` data-unit="${esc(ch.unit)}"` : "";
      const kind = ch.kind === "line" ? "line" : ch.kind === "donut" ? "donut" : "bars";
      const st = c.stat;
      return wrap("chart", `${head(c, x, { lede: false })}<div class="v5-body">
  <div class="v5-card" style="flex:1.7;padding:22px 26px">${figure(kind, list.map((l) => ({ ...l, title: l.title })), unit)}</div>
  <div class="v5-panel v5-panel-primary" style="flex:1;justify-content:center" data-fit-box>
    ${st?.value ? `<p class="v5-statval" style="font-size:max(52px,calc(var(--s) * 72px));color:var(--on-primary)">${esc(st.value)}</p><p class="v5-p" style="color:var(--on-primary);font-weight:700">${esc(st.label)}</p>` : `<div style="color:var(--on-primary)">${ic("trending-up")}</div>`}
    <p class="v5-statement" style="font-size:max(22px,calc(var(--s) * 28px));color:var(--on-primary)">${esc(c.takeaway || c.lede || "")}</p>
  </div>
</div>`, c, x);
    },
  },
  {
    id: "table", family: "data", photo: "none",
    when: "Structured comparison of 2–4 attributes across 2–6 rows (features, properties, types).",
    slots: `title (≤ 70 chars), table {columns 2–4 × ≤ 18 chars, rows 2–6 × cells ≤ 48 chars}`,
    render: (c, x) => {
      const t = c.table || { columns: [], rows: [] };
      const cols = t.columns.slice(0, 4);
      const rows = t.rows.slice(0, 6).map((r) => cols.map((_, k) => r[k] ?? ""));
      return wrap("table", `${head(c, x)}<div class="v5-body" style="flex-direction:column" data-fit-box><table class="v5-table"><thead><tr>${cols.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`, c, x);
    },
  },
  {
    id: "definition", family: "concept", photo: "optional",
    when: "Introducing/defining the key concept: what it is + 3 key features.",
    slots: `title (≤ 60 chars), term (≤ 30 chars), lede = definition (≤ 200 chars), items 3 [{icon, title ≤ 26 chars, text ≤ 80 chars}], photo_query optional`,
    render: (c, x) => {
      const its = items(c, 3);
      return wrap("definition", `${head(c, x, { lede: false })}<div class="v5-body" style="flex-direction:column">
  <div style="display:flex;gap:var(--gap);flex:1.15;min-height:0">
    <div class="v5-panel v5-panel-primary" style="flex:1;justify-content:center" data-fit-box>
      <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap"><h3 style="font-family:var(--font-heading);font-size:max(30px,calc(var(--s) * 40px));line-height:1.1;color:var(--on-primary);margin:0">${esc(c.term || c.title)}</h3><span style="font-size:18px;letter-spacing:.12em;text-transform:uppercase;color:var(--on-primary);opacity:.8">${x.language === "Hindi" ? "परिभाषा" : "definition"}</span></div>
      <p style="font-size:max(21px,calc(var(--s) * 26px));line-height:1.4;color:var(--on-primary);margin:0">${esc(c.lede || "")}</p>
    </div>
    ${c.photo ? photo(c, "v5-photo", "flex:0 0 360px") : ""}
  </div>
  ${its.length ? `<div class="v5-grid v5-cols-${its.length}" style="flex:1">${its.map((it) => `<div class="v5-card" data-fit-box style="flex-direction:row;gap:calc(var(--s) * 18px);align-items:flex-start;padding:calc(var(--s) * 22px)">${icbox(it.icon)}<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h3 class="v5-h3" style="font-size:max(21px,calc(var(--s) * 24px))">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div></div>`).join("")}</div>` : ""}
</div>`, c, x);
    },
  },
  {
    id: "matrix", family: "diagram", photo: "none", minItems: 4, maxItems: 4,
    when: "Four categories on two axes (2×2: e.g. impact × effort, speed × accuracy).",
    slots: `title (≤ 70 chars), axes {x ≤ 18 chars, y ≤ 18 chars}, items exactly 4 (top-left, top-right, bottom-left, bottom-right) [{icon, title ≤ 22 chars, text ≤ 60 chars}]`,
    render: (c, x) => wrap("matrix", `${head(c, x)}<div class="v5-body"><div style="flex:1;min-width:0">${figure("matrix", items(c, 4), `data-x="${esc(c.axes?.x || "")}" data-y="${esc(c.axes?.y || "")}"`)}</div></div>`, c, x),
  },
  {
    id: "diagram", family: "diagram", photo: "none", minItems: 3, maxItems: 7,
    when: "A flow (left→right causal chain) or tree (hierarchy/classification) diagram.",
    slots: `title (≤ 70 chars), lede (optional), diagram "flow"|"tree", items 3–7 [{icon, title ≤ 22 chars, text ≤ 50 chars, parent (tree only: parent title)}]`,
    render: (c, x) => {
      const kind = c.diagram === "tree" ? "tree" : "flow";
      const its = items(c, 7).map((i: any) => i);
      const lis = its.map((it: any) => `<li${it.parent ? ` data-parent="${esc(it.parent)}"` : ""}>${it.icon ? `<i class="ic" data-icon="${esc(it.icon)}"></i>` : ""}<strong>${esc(it.title)}</strong>${it.text ? ` ${esc(it.text)}` : ""}</li>`).join("");
      return wrap("diagram", `${head(c, x)}<div class="v5-body"><div style="flex:1;min-width:0"><figure class="v3-diagram" data-kind="${kind}" data-size="27" style="position:relative;width:100%;height:100%">${lis}</figure></div></div>`, c, x);
    },
  },
  {
    id: "text-focus", family: "text", photo: "optional",
    when: "An explanation that is mainly text: one big statement + 3–4 supporting points. Use sparingly.",
    slots: `title (≤ 70 chars), lede = key statement (≤ 150 chars), items 2–4 [{icon, title ≤ 30 chars optional, text ≤ 120 chars}], photo_query optional`,
    render: (c, x) => {
      let its = items(c, 4);
      let lede = c.lede || "";
      // no key statement: the first point becomes it (an empty panel never ships)
      if (!lede && its.length >= 2) {
        lede = its[0].text || its[0].title || "";
        its = its.slice(1);
      }
      const panel = lede || c.photo;
      return wrap("text-focus", `${head(c, x, { lede: false })}<div class="v5-body">
  ${panel ? `<div class="v5-panel ${c.photo ? "v5-panel-soft" : "v5-panel-primary"}" style="flex:0 0 40%;justify-content:${c.photo ? "flex-end" : "center"};gap:22px;position:relative" data-fit-box>
    ${c.photo ? `<div class="v5-photo" style="position:absolute;inset:0;border-radius:var(--radius)"><img src="asset:${esc(c.photo)}" alt=""></div><div style="position:absolute;inset:0;border-radius:var(--radius);background:linear-gradient(0deg,rgba(8,10,20,.88),rgba(8,10,20,.15) 70%)"></div>` : `<div style="width:64px;height:6px;border-radius:3px;background:var(--accent)"></div>`}
    ${lede ? `<p class="v5-statement" style="position:relative;${c.photo ? "color:#fff" : "color:var(--on-strong)"}">${esc(lede)}</p>` : ""}
  </div>` : ""}
  <div class="v5-rows" data-fit-box>${its.map((it) => `<div class="v5-row" style="align-items:flex-start;padding:calc(var(--s) * 16px) 0">${it.icon ? `<span class="v5-mark v5-mark-p" style="width:calc(var(--s) * 44px);height:calc(var(--s) * 44px)">${ic(it.icon)}</span>` : ""}<div class="v5-row-txt">${it.title ? `<h3 class="v5-h3" style="font-size:max(21px,calc(var(--s) * 25px))">${esc(it.title)}</h3>` : ""}<p class="v5-p" style="color:var(--ink);opacity:.85">${esc(it.text)}</p></div></div>`).join("")}</div>
</div>`, c, x);
    },
  },
  {
    id: "takeaways", family: "summary", photo: "none", minItems: 3, maxItems: 5,
    when: "Conclusion / summary / key takeaways near the end.",
    slots: `title (≤ 60 chars), items 3–5 [{icon, title ≤ 34 chars, text ≤ 90 chars}], takeaway = the one-sentence bottom line (≤ 130 chars)`,
    render: (c, x) => {
      const its = items(c, 5);
      const two = its.length >= 4;
      return wrap("takeaways", `${head(c, x, { lede: false })}<div class="v5-body" style="flex-direction:column">
  <div class="v5-grid ${two ? "v5-cols-2" : `v5-cols-${its.length}`}" style="flex:1">${its.map((it, k) => `<div class="v5-card" data-fit-box style="flex-direction:row;align-items:flex-start;gap:calc(var(--s) * 18px);padding:calc(var(--s) * 22px)${two && its.length % 2 && k === its.length - 1 ? ";grid-column:span 2" : ""}"><span class="v5-mark v5-mark-p" style="width:calc(var(--s) * 46px);height:calc(var(--s) * 46px)">${ic(it.icon || "check")}</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h3 class="v5-h3">${esc(it.title)}</h3>${it.text ? `<p class="v5-p">${esc(it.text)}</p>` : ""}</div></div>`).join("")}</div>
  ${c.takeaway ? `<div class="v5-panel v5-panel-primary" style="flex:none;flex-direction:row;align-items:center;gap:22px;padding:calc(var(--s) * 22px) calc(var(--s) * 30px)" data-fit-box><div style="color:var(--on-primary);width:40px;height:40px;flex:none">${ic("lightbulb")}</div><p class="v5-statement" style="font-size:max(21px,calc(var(--s) * 26px));color:var(--on-primary)">${esc(c.takeaway)}</p></div>` : ""}
</div>`, c, x);
    },
  },
  {
    id: "references", family: "references", photo: "none",
    when: "Engine-built list of sources (always the last or second-last slide).",
    slots: `title only (engine fills the citations)`,
    render: (c, x) => {
      const refs = x.references || [];
      const hi = x.language === "Hindi";
      const isEnc = (r: (typeof refs)[number]) => (r.kind ? r.kind === "wikipedia" : /wikipedia|britannica|encyclop/i.test(r.text));
      const isSch = (r: (typeof refs)[number]) => (r.kind ? ["openalex", "crossref", "semanticscholar"].includes(r.kind) : !isEnc(r) && /doi\.org|journal|proceedings|arxiv|letters|review|nature\b|science\b|\d+\s*\(\d+\)|\b\d+,\s*\d+[–-]\d+/i.test(r.text));
      // a grouped encyclopedia entry counts every article it names
      const cnt = (r: (typeof refs)[number]) => Math.max(1, r.count || 1);
      const sum = (l: typeof refs) => l.reduce((a, r) => a + cnt(r), 0);
      const total = sum(refs);
      const sch = sum(refs.filter(isSch));
      const enc = sum(refs.filter(isEnc));
      const other = total - sch - enc;
      const chip = (n: number, en: string, hn: string, icon: string) => (n ? `<div class="v5-chip" style="background:color-mix(in srgb,var(--on-strong) 14%,transparent);color:var(--on-strong);font-size:18px;padding:8px 14px"><i data-icon="lucide:${icon}" style="width:22px;height:22px;flex:none"></i><span>${n} ${hi ? hn : en}</span></div>` : "");
      return wrap("references", `${head(c, x, { lede: false })}<div class="v5-body" style="gap:40px">
  <div class="v5-panel" style="flex:0 0 280px;background:var(--strong);color:var(--on-strong);display:flex;flex-direction:column;justify-content:center;gap:18px;padding:32px 28px">
    <span style="display:flex;color:var(--on-strong);opacity:.9"><i data-icon="lucide:book-open" style="width:56px;height:56px"></i></span>
    <div style="font-family:var(--font-heading);font-weight:800;font-size:84px;line-height:1">${total}</div>
    <div style="font-size:20px;opacity:.85">${hi ? "स्रोत, जिनसे हर तथ्य लिया गया" : total === 1 ? "source behind the facts" : "sources behind the facts"}</div>
    <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">${chip(sch, sch === 1 ? "scholarly paper" : "scholarly papers", "शोध पत्र", "graduation-cap")}${chip(enc, enc === 1 ? "encyclopedia article" : "encyclopedia articles", "विश्वकोश लेख", "library")}${chip(other, other === 1 ? "other source" : "other sources", "अन्य स्रोत", "globe")}</div>
  </div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:14px" data-fit-box>
    <ol class="v5-refs" style="columns:1">${refs.map((r) => `<li><b>[${r.n}]</b><span>${esc(r.text)}</span></li>`).join("")}</ol>
    ${x.credits && x.credits.length ? `<div class="v5-credits"><p style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">${hi ? "चित्र श्रेय" : "Image credits"}</p>${x.credits.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
  </div>
</div>`, c, x);
    },
  },
  // ── engine v6: data and diagram layouts drawn by the v3 diagram engine in the deck's own palette ──
  {
    id: "chart-trend", family: "data", photo: "none", v6: true,
    when: "A GROWTH / TREND chart: one real number changing over time (years) or across 4–10 categories, shown big across the slide with the insight called out. Only real data from the facts.",
    slots: `title (action title ≤ 70 chars stating what the trend shows), chart {kind line|bars, unit (≤ 6 chars, e.g. "%", "$bn"), items 4–10 [{label ≤ 12 chars (year or category), value number}]}, takeaway (≤ 110 chars: the insight), stat {value ≤ 10 chars, label ≤ 40 chars} optional: the headline change (e.g. "+38%" "since 1980")`,
    render: (c, x) => {
      const ch = c.chart || { kind: "line", items: [] };
      const kind = ch.kind === "bars" ? "bars" : "line";
      const list: SlotItem[] = ch.items.slice(0, 10).map((i) => ({ title: i.label, value: String(i.value) }));
      const unit = ch.unit ? ` data-unit="${esc(ch.unit)}"` : "";
      const st = c.stat;
      return wrap("chart-trend", `${head(c, x, { lede: false })}<div class="v5-body" style="gap:calc(var(--s) * 22px)">
  <div class="v5-card" style="flex:1.75;min-width:0;padding:calc(var(--s) * 14px) calc(var(--s) * 16px) 8px">${c.svg ? `<figure class="v6-chartbox" style="margin:0;width:100%;height:100%">${c.svg}</figure>` : `<div style="position:relative;width:100%;height:100%;overflow:hidden">${figure(kind, list, `${unit} data-size="24"`, "position:relative;width:calc(100% - 90px);height:100%;margin:0 45px")}</div>`}</div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:calc(var(--s) * 18px);justify-content:center" data-fit-box>
    ${st?.value ? `<div class="v5-trend-stat"><b>${esc(st.value)}</b><span>${esc(st.label || "")}</span></div>` : ""}
    <p class="v5-trend-insight">${esc(c.takeaway || c.lede || "")}</p>
  </div>
</div>`, c, x);
    },
  },
  {
    id: "donut", family: "data", photo: "none", v6: true,
    when: "SHARES OF A WHOLE: 2–6 real parts that add up (e.g. who owns what share of wealth, energy mix, budget split). Only real data from the facts.",
    slots: `title (action title ≤ 70 chars), chart {kind donut, unit (e.g. "%"), items 2–6 [{label ≤ 22 chars, value number}]}, takeaway (≤ 140 chars: what the split means), lede optional (≤ 90 chars context)`,
    render: (c, x) => {
      const ch = c.chart || { kind: "donut", items: [] };
      const list: SlotItem[] = ch.items.slice(0, 6).map((i) => ({ title: i.label, value: String(i.value) }));
      const unit = ch.unit ? ` data-unit="${esc(ch.unit)}"` : "";
      return wrap("donut", `${head(c, x, { lede: false })}<div class="v5-body">
  <div class="v5-card" style="flex:1.55;min-width:0;padding:calc(var(--s) * 16px) calc(var(--s) * 20px)">${c.svg ? `<figure class="v6-chartbox" style="margin:0;width:100%;height:100%">${c.svg}</figure>` : figure("donut", list, `${unit} data-size="25"`)}</div>
  <div class="v5-panel v5-panel-primary" style="flex:1;justify-content:center;gap:calc(var(--s) * 16px)" data-fit-box>
    <div style="color:var(--on-primary)">${ic("pie-chart")}</div>
    ${c.lede ? `<p class="v5-p" style="color:var(--on-primary);opacity:.92">${esc(c.lede)}</p>` : ""}
    <p class="v5-statement" style="font-size:max(22px,calc(var(--s) * 28px));color:var(--on-primary)">${esc(c.takeaway || "")}</p>
  </div>
</div>`, c, x);
    },
  },
  {
    id: "flowchart", family: "diagram", photo: "none", v6: true,
    when: "A FLOWCHART with a decision or branches: cause → effect chains that split, a decision process (yes/no), how one thing leads to two outcomes. 4–8 boxes.",
    slots: `title (action title ≤ 70 chars), flow {nodes 4–8 [{id "a".."h", label ≤ 28 chars, type step|decision|end}], edges [{from id, to id, label ≤ 12 chars optional (e.g. "yes", "no", "raises")}]}, takeaway optional (≤ 110 chars)`,
    render: (c, x) => {
      const nodes = c.flow?.nodes || [];
      // the engine draws the chart as SVG before render (renderFitted); without it the boxes become a flow diagram
      const body = c.svg
        ? `<div class="v5-card" style="flex:1;min-height:0;padding:calc(var(--s) * 16px);display:flex;align-items:center;justify-content:center"><figure class="v6-flowchart" style="margin:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center">${c.svg}</figure></div>`
        : `<div style="flex:1;min-width:0">${figure("flow", nodes.slice(0, 6).map((n) => ({ title: n.label })))}</div>`;
      return wrap("flowchart", `${head(c, x, { lede: false })}<div class="v5-body" style="flex-direction:column;gap:calc(var(--s) * 14px)">${body}${c.takeaway ? `<p class="v5-trend-insight" style="flex:none" data-fit-box>${esc(c.takeaway)}</p>` : ""}</div>`, c, x);
    },
  },
  {
    id: "closing", family: "closing", photo: "none",
    when: "Last slide: thank you / questions.",
    slots: `title (e.g. "Thank you"), lede (≤ 90 chars, e.g. an invitation for questions or the one thing to remember), items optional 3 key takeaways [{icon, title ≤ 80 chars}]`,
    render: (c, x) => wrap("closing", `${x.heroPhoto && !x.theme.v6 ? `<div class="v5-photo" style="position:absolute;right:80px;top:100px;width:440px;height:500px;z-index:1"><img src="asset:${esc(x.heroPhoto)}" alt=""></div>` : x.theme.v6 ? artPanelV6({ ...x, heroStat: undefined }) : artPanel([...(x.deckIcons || [])].slice(0, 3), "right:80px;top:110px")}<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${items(c, 3).length ? 18 : 26}px;max-width:620px" data-fit-box>
  ${logoEl(x)}<div class="v5-eyebrow">${esc(c.eyebrow || shortTitle(x.deckTitle))}</div>
  <h2 class="v5-hero-title" data-fit-title style="font-size:calc(var(--ts) * ${items(c, 3).length ? 72 : 96}px)">${esc(c.title)}</h2>
  ${c.lede ? `<p class="v5-hero-sub"${items(c, 3).length ? ` style="font-size:min(28px,max(22px,calc(var(--s) * 24px)))"` : ""}>${esc(c.lede)}</p>` : ""}
  ${items(c, 3).length ? `<div class="v5-recap">${items(c, 3).map((it, k) => `<div class="v5-recap-row"><span class="v5-recap-n">${k + 1}</span><span class="v5-recap-t">${esc(it.title || it.text)}</span></div>`).join("")}</div>` : ""}
  ${x.fields.find((f) => /presented/i.test(f.label)) ? `<p class="v5-hero-sub" style="font-size:22px;opacity:.9">${esc(x.fields.find((f) => /presented/i.test(f.label))!.value)}</p>` : ""}
</div>`, c, x, { hero: true, noFoot: true }),
  },
];

export function templateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** the catalog as the planner reads it (one line per template); v6-only layouts are left out for engine v5 */
export function catalogText(engine: "v5" | "v6" = "v5"): string {
  return TEMPLATES.filter((t) => engine === "v6" || !t.v6).map((t) => `- ${t.id} [${t.photo === "required" ? "needs photo" : t.photo === "optional" ? "photo optional" : "no photo"}] — ${t.when} SLOTS: ${t.slots}`).join("\n");
}
