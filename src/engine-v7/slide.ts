/**
 * Engine v7 — the slide designer. For each slide the AI writes one complete, standalone HTML document (1920x1080,
 * CSS + inline SVG) designed for that slide's idea. The only shared inputs are the deck concept, its fonts and its
 * images; there are no components, templates or layout names.
 */
import fs from "fs";
import { chat } from "../engine-v3/llm";
import type { V7Board, V7Concept, V7Image, V7Slide } from "./types";

export const DESIGN_SYSTEM = `You are a world-class presentation designer and front-end craftsperson. You design ONE slide as a complete standalone HTML document, rendered by headless Chrome at exactly 1920x1080 and exported to PDF.

Hard technical rules:
- Output one full document: <!doctype html><html><head><style>…</style></head><body>…</body></html>, inside a single \`\`\`html code block. Nothing else after it.
- html, body: margin 0; the slide is a 1920px x 1080px box with overflow hidden. Use absolute or grid/flex layout in px. Everything must fit inside 1920x1080 with at least 64px clear margin for all text.
- No JavaScript, no external URLs except the image files listed (relative paths exactly as given). The fonts are already loaded: use them by their family names in CSS (font-family: 'Name', fallback). No <link> tags needed.
- Diagrams, charts, icons and decorative shapes: draw them yourself with inline SVG or CSS. Charts use the real numbers given; label axes/values so they read clearly.
- Text is real HTML text (never text baked into an image). Minimum font size 26px for EVERY piece of text — tags, captions, axis labels, diagram labels, footnotes included (24px only for a source line); body text usually 32–44px; titles big and confident. The engine measures the page: any text under 22px is an automatic failure. If a label does not fit at 26px, the drawing is too crowded — use fewer, shorter labels or a bigger drawing, never smaller type.
- No running headers, footers, page numbers, document codes, section tabs or decorative strips repeated along the top or bottom edge. Each slide's space belongs to its content.
- Readability first: strong contrast for all text; text placed over a photo gets a solid or gradient scrim behind it.
- Nothing collides: boxes, cards, labels and pictures never overlap each other or the title unless the layering is a deliberate design move; keep at least 32px between separate elements. Size every text box so its text fits with room to spare (long labels wrap inside wide boxes).
- SVG diagrams: the viewBox must contain every shape and label with 40px of padding (labels near an edge use text-anchor so they grow inward). Plan label positions before drawing: each label gets its own free space next to the thing it names — never on top of a line, bar, node or another label; use a short leader line when space is tight. Give the svg an explicit width and height in px that fits the slide.
- Lines are clean and geometric: no sketch/roughen SVG filters (feTurbulence, feDisplacementMap), no wobbly hand-drawn paths imitating a pencil. A "hand-made" feel, if the concept wants it, comes from type, colour and composition, not from distorted lines.
- Finish the visual completely: if the sketch says a grid of 100 dots, a full tree or a complete chart, draw all of it (an SVG <pattern> or many small shapes are fine). No empty frames, placeholder boxes or half-drawn diagrams; no large blank areas that the composition did not intend. The engine fails slides with empty boxes or big blank regions.
- Symbols like ticks, stars, arrows or check marks are drawn in SVG, never typed as emoji or dingbat characters.
- Keep words lean. Use exactly the slide's content (you may shorten wording or split it into labels, but do not invent facts or numbers). No emoji. No lorem ipsum. No markdown symbols.
- Do not put the slide number, the deck title or a logo on the slide unless the design really needs it.

Design rules:
- Follow the deck concept (palette, fonts, motif, art direction) so the deck feels like one designer made it — but design THIS slide from scratch for THIS idea. Never fall back to generic "title + bullet list" or "three equal cards" unless the idea truly is three parallel things, and even then make it special.
- The visual must EXPLAIN the idea (diagram, chart, formula, worked example, metaphor image, annotated figure, typographic hero…), not decorate it.
- Clear hierarchy: one thing the eye hits first. Generous white space. Align things on a deliberate grid. Avoid clutter, avoid tiny elements, avoid lines crossing text.
- Use the canvas: the main visual is big and confident (a diagram or chart usually fills 45–65% of the slide), not a small figure floating in empty space. Labels on diagrams are at least 26px.
- Make it look finished and premium — like a slide from a top design studio, not a web page.`;

export function slidePrompt(slide: V7Slide, board: V7Board, concept: V7Concept, fonts: { display: string; body: string; accent?: string }, images: V7Image[], neighbours: V7Board[], deckTitle: string, total: number, refs?: { n: number; text: string }[]): string {
  const img = images.filter((i) => i.n === slide.n);
  return `DECK: "${deckTitle}" — ${total} slides. This is slide ${slide.n} of ${total}.

DECK CONCEPT: ${concept.conceptName}
Art direction: ${concept.artDirection}
Palette: ${concept.palette.map((p) => `${p.hex} (${p.use})`).join(", ")}
Fonts (already loaded): display '${fonts.display}', body '${fonts.body}'${fonts.accent ? `, accent '${fonts.accent}'` : ""}
Motif: ${concept.motif}

THIS SLIDE
Title: ${slide.title}
The idea the audience must get: ${slide.idea}
Content to show:
${refs ? `A reference list of ${refs.length} entries (the longest is ${Math.max(...refs.map((r) => r.text.length))} characters). Do NOT write the references yourself: put the exact comment <!--REFS--> where the list goes, inside a container you size and style. The engine replaces it with ${refs.length} blocks of this shape: <div class="ref"><span class="ref-n">1</span><span class="ref-text">…full citation…</span></div>. Style .ref, .ref-n and .ref-text in your CSS (font size 26–30px so all ${refs.length} entries fit comfortably).` : slide.body || "(title only)"}
Designer's sketch for this slide: ${board.visual || "(your call)"}
Composition sketch: ${board.composition || "(your call)"}
${img.length ? `Image file available for this slide (use it, cropped with object-fit: cover as the design needs): ${img.map((i) => `"${i.file}" (${i.width}x${i.height}, shows: ${i.subject})`).join("; ")}` : "No image file for this slide: draw any visual in SVG/CSS."}

Other slides in this deck look like this (do NOT repeat their composition):
${neighbours.filter((b) => b.n !== slide.n).map((b) => `- slide ${b.n}: ${b.composition}`).join("\n")}

Write the complete HTML document now.`;
}

export function extractHtml(text: string): string | null {
  const t = String(text || "");
  // the slide is the fenced block (or the raw document) that holds a <body>; other blocks (a css-only fence) are skipped
  const blocks = [...t.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const open = t.lastIndexOf("```");
  if (blocks.length === 0 && open >= 0) blocks.push(t.slice(open).replace(/^```[a-zA-Z]*\s*/, ""));
  blocks.push(t);
  for (let html of blocks) {
    const i = html.search(/<!doctype html|<html/i);
    if (i < 0) continue;
    html = html.slice(i);
    const end = html.search(/<\/html>/i);
    if (end > 0) html = html.slice(0, end + 7);
    else if (/<body[\s>]/i.test(html) && !/<\/body>/i.test(html)) continue; // cut off mid-body: not a complete slide
    if (!/<body[\s>]/i.test(html) || html.length < 400) continue;
    return html.trim();
  }
  return null;
}

/** usability check; a reply that fails is kept in V7_DEBUG_DIR for inspection */
function usable(label: string, needRefs = false) {
  return (t: string) => {
    const h = extractHtml(t);
    const ok = !!h && (!needRefs || /<!--\s*REFS\s*-->/i.test(h));
    if (!ok && process.env.V7_DEBUG_DIR) try { fs.writeFileSync(`${process.env.V7_DEBUG_DIR}/unusable-${label.replace(/[^a-z0-9.]+/gi, "_")}-${Date.now()}.txt`, t); } catch {}
    return ok;
  };
}

/** Puts the real reference list where the designer left <!--REFS--> (the AI never writes citations itself). */
export function fillRefs(html: string, refs: { n: number; text: string; url: string }[]): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const list = refs.map((r) => `<div class="ref"><span class="ref-n">${r.n}</span><span class="ref-text">${esc(r.text)}</span></div>`).join("\n");
  return html.replace(/<!--\s*REFS\s*-->/i, list);
}

export async function designSlide(prompt: string, label: string, needRefs = false) {
  const res = await chat("design", [
    { role: "system", content: DESIGN_SYSTEM },
    { role: "user", content: prompt },
  ], { temperature: 0.8, maxTokens: Number(process.env.V7_MAX_TOKENS || 14000), timeoutMs: Number(process.env.V7_TIMEOUT_MS || 300_000), label, stream: process.env.V7_STREAM === "on", validate: usable(label, needRefs) });
  return { html: extractHtml(res.text)!, meta: res };
}

export async function fixSlide(prompt: string, html: string, problems: string[], label: string, screenshot?: Buffer, needRefs = false) {
  const text = `${prompt}

YOUR PREVIOUS VERSION of this slide:
\`\`\`html
${html}
\`\`\`

A reviewer looked at the rendered slide and found these problems:
${problems.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Fix every problem — problems measured by the engine (cut off, overlapping, too small, empty, running header) are automatic failures and must all be gone. When a diagram is crowded, simplify it (fewer or shorter labels, bigger shapes, more space) rather than shrinking text; when there is a big blank area, enlarge the main visual or rebalance the composition. Keep what already works (concept, idea, overall design) unless a problem requires changing it. Return the complete corrected HTML document.${needRefs ? " Keep the <!--REFS--> comment exactly where the list goes (the engine fills it; the rendered list you saw came from it)." : ""}`;
  const content: any = screenshot
    ? [{ type: "text", text }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshot.toString("base64")}` } }]
    : text;
  const res = await chat("design", [
    { role: "system", content: DESIGN_SYSTEM },
    { role: "user", content },
  ], { temperature: 0.4, maxTokens: Number(process.env.V7_MAX_TOKENS || 14000), timeoutMs: Number(process.env.V7_TIMEOUT_MS || 300_000), label, stream: process.env.V7_STREAM === "on", validate: usable(label, needRefs) });
  return { html: extractHtml(res.text)!, meta: res };
}
