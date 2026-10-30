/** Engine v3 — Art director: one coherent design system for the whole deck (not layouts). */
import { chatJson } from "../llm";
import type { Brief, DesignSystem, FontPair, Outline } from "../types";

/** Curated font pairs. Each web font has an Office-safe twin for the PPTX so text never falls back to a random font. */
export const FONT_PAIRS: FontPair[] = [
  { id: "geometric", heading: "Poppins", body: "Inter", googleFamilies: ["Poppins:wght@400;600;700;800", "Inter:wght@400;500;600"], pptxHeading: "Century Gothic", pptxBody: "Calibri" },
  { id: "editorial", heading: "Playfair Display", body: "Source Sans 3", googleFamilies: ["Playfair+Display:wght@500;700;800", "Source+Sans+3:wght@400;600"], pptxHeading: "Georgia", pptxBody: "Calibri" },
  { id: "scholarly", heading: "Merriweather", body: "Open Sans", googleFamilies: ["Merriweather:wght@400;700;900", "Open+Sans:wght@400;600"], pptxHeading: "Georgia", pptxBody: "Segoe UI" },
  { id: "technical", heading: "Space Grotesk", body: "IBM Plex Sans", googleFamilies: ["Space+Grotesk:wght@500;600;700", "IBM+Plex+Sans:wght@400;500;600"], pptxHeading: "Segoe UI Semibold", pptxBody: "Segoe UI" },
  { id: "modern", heading: "Montserrat", body: "Lato", googleFamilies: ["Montserrat:wght@500;700;800", "Lato:wght@400;700"], pptxHeading: "Century Gothic", pptxBody: "Calibri" },
  { id: "classic", heading: "Lora", body: "Lato", googleFamilies: ["Lora:wght@500;600;700", "Lato:wght@400;700"], pptxHeading: "Cambria", pptxBody: "Calibri" },
  { id: "bold", heading: "Oswald", body: "Roboto", googleFamilies: ["Oswald:wght@500;600;700", "Roboto:wght@400;500;700"], pptxHeading: "Franklin Gothic Medium", pptxBody: "Segoe UI" },
  { id: "friendly", heading: "DM Serif Display", body: "DM Sans", googleFamilies: ["DM+Serif+Display", "DM+Sans:wght@400;500;700"], pptxHeading: "Georgia", pptxBody: "Calibri" },
];

export const DEVANAGARI_PAIRS: FontPair[] = [
  { id: "hindi-sans", heading: "Mukta", body: "Noto Sans Devanagari", googleFamilies: ["Mukta:wght@500;700;800", "Noto+Sans+Devanagari:wght@400;500;700"], pptxHeading: "Nirmala UI", pptxBody: "Nirmala UI", script: "devanagari" },
  { id: "hindi-serif", heading: "Noto Serif Devanagari", body: "Hind", googleFamilies: ["Noto+Serif+Devanagari:wght@500;700", "Hind:wght@400;500;600"], pptxHeading: "Nirmala UI", pptxBody: "Nirmala UI", script: "devanagari" },
];

const SYSTEM = `You are the Art Director of a premium presentation studio. Define ONE design system for a whole academic deck so that slides designed independently by different designers look like one family.
You do NOT define layouts. You define: palette, font pairing, a recurring motif, and a few rules of the visual language.
- Palette: 7 hex colours. bg (slide background), surface (cards/panels), ink (main text), muted (secondary text), primary (brand colour), accent (highlight), accent2 (secondary highlight). Text on bg must have strong contrast (≥ 7:1 for ink, ≥ 4.5:1 for muted). Avoid generic purple-blue AI gradients; choose colours that suit the subject (chemistry lab → deep teal + amber; library/CS → ink navy + warm paper; biology → forest + coral …). Dark or light is your call; classrooms with projectors often read light themes better, but dark can be dramatic for photo-led decks.
- fontPair: choose the id that suits the subject from the list.
- motif: one concrete recurring graphic idea (e.g. "thin 2px accent rule above every title + oversized faded section numbers", "spectrum gradient bar along the bottom edge", "rounded photo masks with an offset outline stroke").
- rules: 4–6 short rules (spacing, how images are treated, how numbers/citations look).
- directions: for EVERY slide in the outline, one or two sentences of art direction describing an ambitious, specific composition for that slide (where the visual goes and how big, how the photo is treated, where the title sits, what the key message looks like). Make neighbouring slides clearly different (e.g. full-bleed photo with scrim → giant number + 3 facts → horizontal process diagram spanning the width → split screen with masked photo → comparison table …). The main visual should usually occupy 40–60% of the canvas. Do not repeat the same composition more than twice in a deck. The title slide must be the most striking; References stays calm.
Reply with ONLY JSON: {"name":"","mood":"","dark":false,"palette":{"bg":"#","surface":"#","ink":"#","muted":"#","primary":"#","accent":"#","accent2":"#"},"fontPair":"","motif":"","rules":[],"directions":[{"n":1,"idea":""}]}`;

export async function runArtDirector(brief: Brief, outline?: Outline, assets?: { forSlides: number[]; description: string }[]): Promise<DesignSystem> {
  const pairs = brief.language === "Hindi" ? DEVANAGARI_PAIRS : FONT_PAIRS;
  const { data } = await chatJson<any>("art", [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Deck: "${brief.title}" — ${brief.deckType} for ${brief.level}. Subject: ${brief.subject}. Tone: ${brief.tone}.
Style hint from the user: ${brief.styleHint || "(none — your call)"}
Imagery: ${brief.imagery}
Font pairs (choose id): ${pairs.map((p) => `${p.id} = ${p.heading} / ${p.body}`).join("; ")}
${outline ? `\nOUTLINE (write one direction per slide):\n${outline.slides.map((s) => `${s.n}. [${s.role}] ${s.title} — visual: ${s.visual.kind}${s.visual.idea ? ` (${s.visual.idea})` : ""}${assets?.some((a) => a.forSlides.includes(s.n)) ? ` — has photo: ${assets!.find((a) => a.forSlides.includes(s.n))!.description.slice(0, 80)}` : ""}; ${s.points.length} points`).join("\n")}` : ""}`,
    },
  ], { temperature: 0.8, maxTokens: 5000, label: "art director" });

  const font = pairs.find((p) => p.id === data.fontPair) || pairs[0];
  const pal = fixPalette(data.palette || {}, !!data.dark);
  return buildDesignSystem({
    name: data.name || "Deck style",
    mood: data.mood || "",
    dark: luminance(pal.bg) < 0.4,
    palette: pal,
    font,
    motif: data.motif || "thin accent rule above titles",
    rules: Array.isArray(data.rules) ? data.rules.slice(0, 6).map(String) : [],
    directions: Array.isArray(data.directions) ? data.directions.filter((d: any) => d && d.idea).map((d: any) => ({ n: Number(d.n), idea: String(d.idea) })) : [],
  });
}

export function buildDesignSystem(d: Omit<DesignSystem, "css" | "fontLink">): DesignSystem {
  const families = d.font.googleFamilies.map((f) => `family=${f}`).join("&");
  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families}&display=block" rel="stylesheet">`;
  const p = d.palette;
  const css = `:root{--bg:${p.bg};--surface:${p.surface};--ink:${p.ink};--muted:${p.muted};--primary:${p.primary};--accent:${p.accent};--accent2:${p.accent2};
--font-heading:'${d.font.heading}',${d.font.script === "devanagari" ? "'Noto Sans Devanagari'," : ""}sans-serif;--font-body:'${d.font.body}',${d.font.script === "devanagari" ? "'Noto Sans Devanagari'," : ""}sans-serif;}
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden;background:var(--bg);}
.slide{position:relative;width:1280px;height:720px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:24px;line-height:1.4;-webkit-font-smoothing:antialiased;}
.slide h1,.slide h2,.slide h3,.slide h4{font-family:var(--font-heading);margin:0;line-height:1.12;font-weight:700;}
.slide p,.slide ul,.slide ol,.slide figure,.slide blockquote{margin:0;}
.slide ul,.slide ol{padding-left:1.1em;}
.slide img{display:block;}
.slide sup{font-size:0.55em;line-height:0;vertical-align:super;}`;
  return { ...d, css, fontLink };
}

// ── colour helpers ─────────────────────────────────────────────────────
function hex(c: string, fallback: string): string {
  const m = String(c || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return `#${h.toLowerCase()}`;
}
function rgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function fixPalette(p: any, dark: boolean): DesignSystem["palette"] {
  const bg = hex(p.bg, dark ? "#0f172a" : "#f8f6f1");
  const isDark = luminance(bg) < 0.4;
  let ink = hex(p.ink, isDark ? "#f8fafc" : "#111827");
  if (contrast(ink, bg) < 7) ink = isDark ? "#f8fafc" : "#111827";
  let muted = hex(p.muted, isDark ? "#cbd5e1" : "#4b5563");
  if (contrast(muted, bg) < 4.5) muted = isDark ? "#cbd5e1" : "#4b5563";
  return {
    bg,
    surface: hex(p.surface, isDark ? "#1e293b" : "#ffffff"),
    ink,
    muted,
    primary: hex(p.primary, "#0f766e"),
    accent: hex(p.accent, "#f59e0b"),
    accent2: hex(p.accent2, "#e11d48"),
  };
}
