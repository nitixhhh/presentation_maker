/**
 * Engine v6 — GENERATED STYLE. Layout ≠ style: the ~30 designer layouts of v5 stay as skeletons, and every deck gets
 * its own style made for its topic (v3's art-director brain), as design TOKENS: palette, font pairing (Latin + Hindi),
 * card style, background motif, hero treatment, corner radius, shadow. One AI call returns THREE token sets made for
 * this topic ("Choose"), the first being the art director's own pick ("Surprise me"). Code — never the model —
 * turns tokens into CSS and enforces WCAG contrast on every text/background pair the templates use
 * (≥ 4.5:1 body/labels, ≥ 3:1 large titles and graphics), moving a colour's lightness until it passes.
 * The 8 v5 themes stay as seeds/fallback when the style call fails.
 */
import { chatJson } from "../engine-v3/llm";
import type { Brief, FontPair } from "../engine-v3/types";
import { FONT_PAIRS, DEVANAGARI_PAIRS, luminance, contrast } from "../engine-v3/agents/artDirector";
import { THEMES, pickTheme, type Theme, type CardStyle, type Decor } from "../engine-v5/themes";

/** font pairs v6 may use (v3's 8 + 3 more Latin, and 4 Devanagari pairs); every web font has an Office twin for PPTX */
export const V6_FONT_PAIRS: FontPair[] = [
  ...FONT_PAIRS,
  { id: "warm-serif", heading: "Fraunces", body: "Manrope", googleFamilies: ["Fraunces:wght@600;700;800", "Manrope:wght@400;500;700"], pptxHeading: "Georgia", pptxBody: "Calibri" },
  { id: "clean", heading: "Sora", body: "Inter", googleFamilies: ["Sora:wght@500;600;700;800", "Inter:wght@400;500;600"], pptxHeading: "Segoe UI Semibold", pptxBody: "Segoe UI" },
  { id: "bookish", heading: "Libre Baskerville", body: "Source Sans 3", googleFamilies: ["Libre+Baskerville:wght@400;700", "Source+Sans+3:wght@400;600"], pptxHeading: "Baskerville Old Face", pptxBody: "Calibri" },
];
export const V6_HINDI_PAIRS: FontPair[] = [
  ...DEVANAGARI_PAIRS,
  { id: "hindi-round", heading: "Baloo 2", body: "Hind", googleFamilies: ["Baloo+2:wght@600;700;800", "Hind:wght@400;500;600"], pptxHeading: "Nirmala UI", pptxBody: "Nirmala UI", script: "devanagari" },
  { id: "hindi-display", heading: "Rozha One", body: "Mukta", googleFamilies: ["Rozha+One", "Mukta:wght@400;500;700"], pptxHeading: "Nirmala UI", pptxBody: "Nirmala UI", script: "devanagari" },
];

export const CARD_STYLES: CardStyle[] = ["soft", "outline", "tint", "glass"];
export const MOTIFS: Decor[] = ["orbs", "grid", "band", "blobs", "rings", "lines", "mesh", "arcs", "dots", "waves", "corner", "diagonal"] as Decor[];
export type HeroKind = "deep" | "wash" | "dark" | "paper" | "duotone";
export const HEROES: HeroKind[] = ["deep", "wash", "dark", "paper", "duotone"];
export type Shadow = "none" | "soft" | "lifted";

export interface StyleTokens {
  id: string;
  name: string;
  /** one line: why this look suits the topic (shown under the option) */
  why: string;
  mood: string;
  dark: boolean;
  palette: { bg: string; surface: string; ink: string; muted: string; primary: string; accent: string; accent2: string };
  font: string;
  hindiFont: string;
  card: CardStyle;
  motif: Decor;
  hero: HeroKind;
  radius: number;
  shadow: Shadow;
  /** where it came from: the AI art director or a v5 seed (fallback) */
  origin: "ai" | "seed";
}

// ── colour maths ───────────────────────────────────────────────────────────
export function hexOk(c: unknown, fb: string): string {
  const m = String(c || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fb;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return `#${h.toLowerCase()}`;
}
const rgbOf = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r: number[]) => "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** the same colour with its hue turned by `deg` (HSL), for a missing second highlight */
export function rotateHue(h: string, deg: number): string {
  let [r, g, b] = rgbOf(h).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, ss = 0;
  if (mx !== mn) {
    const d = mx - mn;
    ss = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  hh = (hh + deg / 360) % 1;
  const f = (p: number, q: number, t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!ss) return toHex([l, l, l].map((v) => v * 255));
  const q = l < 0.5 ? l * (1 + ss) : l + ss - l * ss, p = 2 * l - q;
  return toHex([f(p, q, hh + 1 / 3), f(p, q, hh), f(p, q, hh - 1 / 3)].map((v) => v * 255));
}
/** mix a → b by t (0..1) in sRGB */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
export const minContrast = (fg: string, bgs: string[]) => Math.min(...bgs.map((b) => contrast(fg, b)));

/**
 * The colour closest to `fg` (same hue, moved toward white or black) that reaches `min` contrast against EVERY
 * background in `bgs`. Picks the direction that can reach it; if neither can, the direction with more contrast.
 */
export function ensureContrast(fg: string, bgs: string[], min: number): string {
  if (minContrast(fg, bgs) >= min) return fg;
  const tries = ["#000000", "#ffffff"].map((pole) => {
    for (let t = 0.04; t <= 1.0001; t += 0.04) {
      const c = mix(fg, pole, t);
      if (minContrast(c, bgs) >= min) return { c, t, ok: true };
    }
    return { c: pole, t: 1, ok: minContrast(pole, bgs) >= min };
  });
  const ok = tries.filter((x) => x.ok).sort((a, b) => a.t - b.t);
  if (ok.length) return ok[0].c;
  return minContrast(tries[0].c, bgs) >= minContrast(tries[1].c, bgs) ? tries[0].c : tries[1].c;
}
/** white or near-black text on a fill, whichever reads better; the fill is darkened/lightened if neither reaches 4.5 */
export function textOn(fill: string): { fill: string; ink: string } {
  const w = contrast("#ffffff", fill), k = contrast("#111111", fill);
  if (Math.max(w, k) >= 4.5) return { fill, ink: w >= k ? "#ffffff" : "#111111" };
  const darker = ensureContrast(fill, ["#ffffff"], 4.5);
  return { fill: darker, ink: "#ffffff" };
}

// ── tokens → hero background ──────────────────────────────────────────────
/** the hero (title / section / closing) background for a token set, and the colours text sits on there */
export function heroOf(t: StyleTokens, deepen = 0): { css: string; stops: string[] } {
  const h = heroBase(t);
  if (!deepen) return h;
  // pushed further from mid-tones so text on it can reach its ratio (light heroes lighter, dark heroes darker)
  const light = h.stops.reduce((a, s) => a + luminance(s), 0) / h.stops.length > 0.35;
  const pole = light ? "#ffffff" : "#000000";
  let css = h.css;
  const stops = h.stops.map((s) => { const n = mix(s, pole, deepen); css = css.split(s).join(n); return n; });
  return { css, stops };
}
function heroBase(t: StyleTokens): { css: string; stops: string[] } {
  const p = t.palette;
  switch (t.hero) {
    case "deep": {
      const a = mix(p.primary, "#000000", 0.45), b = p.primary, c = mix(p.primary, p.accent2, 0.35);
      return { css: `linear-gradient(135deg,${a} 0%,${b} 62%,${c} 100%)`, stops: [a, b, c] };
    }
    case "dark": {
      const base = t.dark ? p.bg : mix(p.ink, "#000000", 0.35);
      const glow = mix(base, p.primary, 0.42), glow2 = mix(base, p.accent2, 0.3);
      return { css: `radial-gradient(1000px 680px at 86% 8%,${glow} 0%,transparent 60%),radial-gradient(820px 560px at 0% 100%,${glow2} 0%,transparent 58%),${base}`, stops: [base, glow, glow2] };
    }
    case "duotone": {
      const a = mix(p.primary, "#000000", 0.2), b = mix(p.accent2, "#000000", 0.25);
      return { css: `linear-gradient(120deg,${a} 0%,${a} 48%,${b} 100%)`, stops: [a, b, mix(a, b, 0.5)] };
    }
    case "paper": {
      const b2 = mix(p.bg, p.primary, t.dark ? 0.1 : 0.05);
      return { css: `linear-gradient(180deg,${p.bg} 0%,${b2} 100%)`, stops: [p.bg, b2] };
    }
    case "wash":
    default: {
      const g1 = mix(p.bg, p.primary, t.dark ? 0.3 : 0.16), g2 = mix(p.bg, p.accent, t.dark ? 0.22 : 0.14);
      return { css: `radial-gradient(1000px 640px at 100% 0%,${g1} 0%,transparent 62%),radial-gradient(760px 520px at 0% 100%,${g2} 0%,transparent 60%),${p.bg}`, stops: [p.bg, g1, g2] };
    }
  }
}

// ── tokens → a contrast-safe v5 Theme (+ the extra CSS variables the templates read) ──
export interface BuiltStyle {
  theme: Theme;
  tokens: StyleTokens;
  /** extra CSS for the deck: text colours proven against their backgrounds */
  css: string;
  /** every text/background pair checked, with its final ratio (tests + the owner's log) */
  checks: { pair: string; ratio: number; min: number }[];
  /** what code changed to make the text readable */
  fixes: string[];
}

export function buildStyle(tok: StyleTokens): BuiltStyle {
  const fixes: string[] = [];
  const P = { ...tok.palette };
  const dark = luminance(P.bg) < 0.3;
  // surface must read as a surface: never identical to the background
  if (contrast(P.surface, P.bg) < 1.04) P.surface = mix(P.bg, dark ? "#ffffff" : "#000000", dark ? 0.06 : 0.03);
  const fix = (name: keyof typeof P, bgs: string[], min: number) => {
    const before = P[name];
    P[name] = ensureContrast(P[name], bgs, min);
    if (P[name] !== before) fixes.push(`${name} ${before} → ${P[name]} (≥ ${min}:1)`);
  };
  // the two highlight colours must be told apart in charts (donut slices, legend): a near-copy of primary moves away
  const dist = (x: string, y: string) => { const a = rgbOf(x), b = rgbOf(y); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
  if (dist(P.accent, P.primary) < 70) {
    const before = P.accent;
    P.accent = dist(P.accent2, P.primary) >= 70 ? P.accent2 : rotateHue(P.primary, 150);
    if (dist(P.accent2, P.accent) < 70 || dist(P.accent2, P.primary) < 70) P.accent2 = rotateHue(P.primary, 220);
    fixes.push(`accent ${before} too close to primary → ${P.accent}`);
  }
  if (dist(P.accent2, P.primary) < 50) P.accent2 = rotateHue(P.primary, 210);
  // body text: ink ≥ 7 where possible (≥ 4.5 always) on background AND cards; muted ≥ 4.5
  fix("ink", [P.bg, P.surface], 7);
  fix("muted", [P.bg, P.surface], 4.5);
  // brand colours are also used as text (eyebrows, numbers, labels): ≥ 4.5 on bg + cards; they stay vivid otherwise
  fix("primary", [P.bg, P.surface], 4.5);
  const accentInk = ensureContrast(P.accent, [P.bg, P.surface], 4.5);
  const accent2Ink = ensureContrast(P.accent2, [P.bg, P.surface], 4.5);
  // graphics (arrows, rules, icons) need ≥ 3:1
  fix("accent", [P.bg], 3);
  fix("accent2", [P.bg], 3);
  // filled panels: text on the primary fill
  const op = textOn(P.primary);
  if (op.fill !== P.primary) { fixes.push(`primary fill ${P.primary} → ${op.fill} so text on it reaches 4.5:1`); P.primary = op.fill; }
  const onAccent = textOn(P.accent).ink;
  // hero background (title / section / closing)
  const tk: StyleTokens = { ...tok, palette: P };
  let hero = heroOf(tk);
  let heroLight = hero.stops.reduce((a, s) => a + luminance(s), 0) / hero.stops.length > 0.35;
  let heroInk = heroLight ? (dark ? P.bg : P.ink) : "#ffffff";
  heroInk = ensureContrast(heroInk, hero.stops, 7);
  // a gradient that no text colour can read on (a bright mid-tone stop) is deepened until the title reads at ≥ 4.5:1
  for (let d = 0.08; minContrast(heroInk, hero.stops) < 4.5 && d <= 0.6; d += 0.08) {
    hero = heroOf(tk, d);
    heroLight = hero.stops.reduce((a, s) => a + luminance(s), 0) / hero.stops.length > 0.35;
    heroInk = ensureContrast(heroLight ? (dark ? P.bg : P.ink) : "#ffffff", hero.stops, 7);
    if (minContrast(heroInk, hero.stops) >= 4.5) fixes.push(`hero background deepened ${Math.round(d * 100)}% so the title reads`);
  }
  let heroMuted = heroLight ? P.muted : mix("#ffffff", P.primary, 0.18);
  heroMuted = ensureContrast(heroMuted, hero.stops, 4.5);
  const heroEyebrow = ensureContrast(heroLight ? P.primary : P.accent, hero.stops, 4.5);
  const heroAccent = ensureContrast(P.accent, hero.stops, 3);
  // the "strong" panel (dark decks: a tinted gradient; light decks: the primary fill)
  const strongStops = dark ? [mix(P.bg, P.primary, 0.34), mix(P.bg, P.accent2, 0.22)] : [P.primary];
  const onStrong = ensureContrast(dark ? P.ink : op.ink, strongStops, 4.5);
  // footer and source line sit on the page or on a motif tint near the bottom edge; full opacity, proven ink
  const footBgs = [P.bg, P.surface, mix(P.bg, P.primary, 0.08), mix(P.bg, P.accent, 0.08)];
  let footInk = ensureContrast(P.muted, footBgs, 4.8);
  if (minContrast(footInk, [P.bg, P.surface]) < 4.5) footInk = [P.ink, "#000000", "#ffffff"].sort((a, b) => minContrast(b, [P.bg, P.surface]) - minContrast(a, [P.bg, P.surface]))[0];
  const checks = [
    { pair: "ink/bg", ratio: contrast(P.ink, P.bg), min: 4.5 },
    { pair: "ink/surface", ratio: contrast(P.ink, P.surface), min: 4.5 },
    { pair: "muted/bg", ratio: contrast(P.muted, P.bg), min: 4.5 },
    { pair: "muted/surface", ratio: contrast(P.muted, P.surface), min: 4.5 },
    { pair: "primary-text/bg", ratio: contrast(P.primary, P.bg), min: 4.5 },
    { pair: "primary-text/surface", ratio: contrast(P.primary, P.surface), min: 4.5 },
    { pair: "accent-text/bg", ratio: contrast(accentInk, P.bg), min: 4.5 },
    { pair: "accent-text/surface", ratio: contrast(accentInk, P.surface), min: 4.5 },
    { pair: "on-primary/primary", ratio: contrast(op.ink, P.primary), min: 4.5 },
    { pair: "on-strong/strong", ratio: minContrast(onStrong, strongStops), min: 4.5 },
    { pair: "hero-ink/hero", ratio: minContrast(heroInk, hero.stops), min: 4.5 },
    { pair: "hero-muted/hero", ratio: minContrast(heroMuted, hero.stops), min: 4.5 },
    { pair: "hero-eyebrow/hero", ratio: minContrast(heroEyebrow, hero.stops), min: 4.5 },
    { pair: "accent-graphic/bg", ratio: contrast(P.accent, P.bg), min: 3 },
    { pair: "footer/bg", ratio: minContrast(footInk, [P.bg, P.surface]), min: 4.5 },
  ].map((c) => ({ ...c, ratio: Math.round(c.ratio * 100) / 100 }));

  const theme: Theme = {
    v6: true,
    id: tok.id, name: tok.name, mood: tok.mood, dark,
    palette: P, font: tok.font, hindiFont: tok.hindiFont, card: tok.card, decor: tok.motif,
    radius: Math.max(0, Math.min(30, Math.round(tok.radius))),
    hero: hero.css, heroInk, heroMuted, suits: [],
  };
  const shadow = tok.shadow === "none" ? "none" : tok.shadow === "lifted"
    ? `0 26px 50px -22px color-mix(in srgb,${dark ? "#000" : P.ink} ${dark ? 70 : 34}%,transparent),0 3px 10px color-mix(in srgb,${dark ? "#000" : P.ink} 8%,transparent)`
    : `0 14px 32px -18px color-mix(in srgb,${dark ? "#000" : P.ink} ${dark ? 60 : 24}%,transparent)`;
  // the title's number panel: on a hero made of the primary colour it becomes a light card, else a primary block
  const onPrimaryHero = tk.hero === "deep" || tk.hero === "duotone";
  const coverInk = onPrimaryHero ? ensureContrast(P.primary, [P.surface], 4.5) : textOn(P.primary).ink;
  // text colours the stylesheet uses, proven above; hero slides get their own set
  const css = `.slide .v6-art{--art-ink:${heroLight ? P.primary : "#ffffff"}}
.slide .v6-cover{${onPrimaryHero ? `--cover-bg:${P.surface};` : ""}--cover-ink:${coverInk}}
:root{--accent-ink:${accentInk};--accent2-ink:${accent2Ink};--primary-ink:${P.primary};--on-accent:${onAccent};--on-strong:${onStrong};--hero-eyebrow:${heroEyebrow};--hero-accent:${heroAccent};--v6-shadow:${shadow}}
.slide .v5-hero{--primary-ink:${heroEyebrow};--accent-ink:${heroEyebrow};--accent2-ink:${heroEyebrow}}
.slide .v5 .v5-eyebrow{color:var(--primary-ink)}
.slide .v5.v5-dark .v5-eyebrow{color:var(--accent-ink)}
.slide .v5.v5-hero .v5-eyebrow,.slide .v5.v5-on-hero .v5-eyebrow{color:var(--hero-eyebrow)}
.slide .v5.v5-hero .v5-eyebrow::before{background:var(--hero-accent)}
.slide .v5 .v5-foot{opacity:1}
.slide .v5:not(.v5-hero):not(.v5-dark) .v5-foot,.slide .v5:not(.v5-hero):not(.v5-dark) .v5-src{color:${footInk};opacity:1}
${tok.shadow !== "soft" ? `.slide .v5 .v5-card{box-shadow:var(--v6-shadow)}` : ""}`;
  return { theme, tokens: tk, css, checks, fixes };
}

// ── seeds (the 8 v5 themes as token sets) ────────────────────────────────
const SEED_HERO: Record<string, HeroKind> = { aurora: "dark", ivory: "paper", ocean: "deep", forest: "wash", noir: "dark", coral: "deep", mono: "dark", royal: "deep" };
export function seedTokens(t: Theme): StyleTokens {
  return { id: `seed-${t.id}`, name: t.name, why: t.mood, mood: t.mood, dark: t.dark, palette: { ...t.palette }, font: t.font, hindiFont: t.hindiFont, card: t.card, motif: t.decor, hero: SEED_HERO[t.id] || "wash", radius: t.radius, shadow: t.card === "soft" ? "soft" : "none", origin: "seed" };
}
/** three seed styles for a topic: the keyword pick first, then two contrasting ones (fallback when the AI fails) */
export function seedStyles(topic: string, subject = "", styleHint = ""): StyleTokens[] {
  const first = pickTheme({ topic, subject, styleHint });
  const rest = THEMES.filter((t) => t.id !== first.id && t.dark !== first.dark).slice(0, 1).concat(THEMES.filter((t) => t.id !== first.id && t.dark === first.dark).slice(0, 1));
  return [first, ...rest].map(seedTokens);
}

// ── the AI art director: three styles made for THIS topic in one call ─────
const SYSTEM = `You are the art director of a premium presentation studio. For ONE academic deck you design THREE different visual styles made for its topic — like three proposals a designer would show a client. You do not design layouts (those are fixed); you define each style's design tokens.
For each style:
- name: 2–3 evocative words tied to the topic (e.g. "Ledger & Plum", "Chlorophyll Field", "Archive Sepia") — never generic ("Modern Blue").
- why: ONE short sentence (≤ 90 chars) on why it suits this topic and audience.
- palette (hex): bg (slide background), surface (cards), ink (main text), muted (secondary text), primary (brand colour: panels, headings accents), accent (highlight), accent2 (second highlight). Choose colours from the SUBJECT's world (economics → ledger cream + plum + money green; photosynthesis → leaf greens + sunlight amber; blockchain → graphite + electric teal; Indian freedom struggle → khadi cream + saffron + deep green; medicine → clinical white + teal + coral; space → midnight + nebula violet). Avoid generic purple-blue AI gradients. primary/accent/accent2 are THREE DIFFERENT hues that belong together (e.g. plum + money green + muted gold; leaf green + amber + sky blue) — never a brighter copy of the primary's own hue, never neon (no #a855f7-style saturated violet or pure #00ffxx). Light backgrounds read best on classroom projectors: make at least two of the three styles light; one may be dark/dramatic. Put your best recommendation FIRST (it is used when the student says "Surprise me"); it is a light style unless the subject itself lives in the dark (space, cinema, night sky).
- dark: true if bg is dark.
- font: one id from the list. hindiFont: one id from the Hindi list.
- card: soft | outline | tint | glass (glass only on dark).
- motif: the recurring background idea, one of: orbs, grid, band, blobs, rings, lines, mesh, arcs, dots, waves, corner, diagonal.
- hero: title/closing background treatment: deep (rich gradient of the primary colour), wash (background with soft colour glows), dark (near-black with coloured glow), paper (calm flat paper), duotone (two-colour diagonal).
- radius: corner radius 0–28 (0 = sharp editorial/swiss, 6 = classic, 16–24 = friendly).
- shadow: none | soft | lifted.
Make the three CLEARLY different from each other (light editorial vs bold colour vs dark, different fonts and motifs), each one still right for the topic. Put your own favourite first.
Reply with ONLY JSON: {"styles":[{"name":"","why":"","mood":"","dark":false,"palette":{"bg":"#","surface":"#","ink":"#","muted":"#","primary":"#","accent":"#","accent2":"#"},"font":"","hindiFont":"","card":"","motif":"","hero":"","radius":12,"shadow":"soft"}]}`;

function normTokens(s: any, k: number, fb: StyleTokens): StyleTokens {
  const pal = s?.palette || {};
  const p = fb.palette;
  const bg = hexOk(pal.bg, p.bg);
  const dark = luminance(bg) < 0.3;
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(String(v || "").trim().toLowerCase() as T) ? (String(v).trim().toLowerCase() as T) : d);
  const card = pick(s?.card, CARD_STYLES, dark ? "glass" : "soft");
  return {
    id: `ai-${k}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(s?.name || fb.name).replace(/\s+/g, " ").trim().slice(0, 32),
    why: String(s?.why || "").replace(/\s+/g, " ").trim().slice(0, 110),
    mood: String(s?.mood || "").slice(0, 60),
    dark,
    palette: { bg, surface: hexOk(pal.surface, dark ? "#1b2234" : "#ffffff"), ink: hexOk(pal.ink, dark ? "#f4f6fb" : "#15161a"), muted: hexOk(pal.muted, dark ? "#b8c0d4" : "#50555f"), primary: hexOk(pal.primary, p.primary), accent: hexOk(pal.accent, p.accent), accent2: hexOk(pal.accent2, p.accent2) },
    font: V6_FONT_PAIRS.some((f) => f.id === s?.font) ? s.font : fb.font,
    hindiFont: V6_HINDI_PAIRS.some((f) => f.id === s?.hindiFont) ? s.hindiFont : fb.hindiFont,
    card: card === "glass" && !dark ? "soft" : card,
    motif: pick(s?.motif, MOTIFS, fb.motif),
    hero: pick(s?.hero, HEROES, dark ? "dark" : "wash"),
    radius: Number.isFinite(Number(s?.radius)) ? Math.max(0, Math.min(28, Number(s.radius))) : fb.radius,
    shadow: pick(s?.shadow, ["none", "soft", "lifted"] as const, "soft"),
    origin: "ai",
  };
}

/** two styles that are nearly the same (same bg family + same primary family) are not two options */
function tooClose(a: StyleTokens, b: StyleTokens): boolean {
  const d = (x: string, y: string) => { const p = rgbOf(x), q = rgbOf(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  return d(a.palette.bg, b.palette.bg) < 22 && d(a.palette.primary, b.palette.primary) < 60;
}

export async function generateStyles(
  brief: Pick<Brief, "title" | "subject" | "deckType" | "level" | "tone" | "language" | "styleHint">,
  opts: { count?: number; avoid?: StyleTokens[]; log?: (m: string) => void } = {}
): Promise<StyleTokens[]> {
  const count = opts.count || 3;
  const seeds = seedStyles(brief.title, brief.subject, brief.styleHint || "");
  const avoid = (opts.avoid || []).map((s) => `${s.name} (bg ${s.palette.bg}, primary ${s.palette.primary}, ${s.font}, ${s.motif})`).join("; ");
  try {
    const { data, meta } = await chatJson<any>("art", [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Deck: "${brief.title}" — ${brief.deckType} for ${brief.level}. Subject: ${brief.subject}. Tone: ${brief.tone}. Language: ${brief.language}.
Style wish from the student: ${brief.styleHint || "(none — your call)"}
Fonts (id = heading / body): ${V6_FONT_PAIRS.map((p) => `${p.id} = ${p.heading} / ${p.body}`).join("; ")}
Hindi fonts (id = heading / body): ${V6_HINDI_PAIRS.map((p) => `${p.id} = ${p.heading} / ${p.body}`).join("; ")}
${avoid ? `The student already saw these and wants something DIFFERENT: ${avoid}\n` : ""}Design ${count} styles.`,
      },
    ], { temperature: 0.9, maxTokens: 2500, label: "v6 style director" });
    const raw: any[] = Array.isArray(data?.styles) ? data.styles : [];
    const out: StyleTokens[] = [];
    raw.forEach((s, k) => {
      const t = normTokens(s, k, seeds[k % seeds.length]);
      if (!out.some((o) => tooClose(o, t)) && !(opts.avoid || []).some((o) => tooClose(o, t))) out.push(t);
    });
    opts.log?.(`style director (${meta.provider}/${meta.model}): ${out.map((s) => s.name).join(", ") || "nothing usable"}`);
    for (const sd of seeds) if (out.length < count && !out.some((o) => tooClose(o, sd))) out.push(sd);
    return out.slice(0, count);
  } catch (e: any) {
    opts.log?.(`style director failed (${String(e?.message || e).slice(0, 100)}) — using the closest designer seeds`);
    return seeds.slice(0, count);
  }
}

export function fontPairV6(tok: Pick<StyleTokens, "font" | "hindiFont">, language: string): FontPair {
  if (language === "Hindi") return V6_HINDI_PAIRS.find((p) => p.id === tok.hindiFont) || V6_HINDI_PAIRS[0];
  return V6_FONT_PAIRS.find((p) => p.id === tok.font) || V6_FONT_PAIRS[0];
}
