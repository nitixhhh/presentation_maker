/**
 * Engine v3 — Designer agent. One per slide, run in parallel.
 * The AI designs the slide freely as HTML/CSS on a 1280×720 canvas; the engine only renders it.
 */
import { chat, type Msg } from "../llm";
import type { Asset, Brief, Deck, DesignSystem, OutlineSlide } from "../types";
import type { Recipe } from "../design/recipes";
import { recipesEnabled } from "../design/pickRecipes";
import { ensureFields, fillPlaceholders, maskText, maskedFieldLines, missingPlaceholders, token, type Field } from "../privacy";

export function designerSystemPrompt(ds: DesignSystem, brief: Brief): string {
  return `You are a world-class presentation designer (think Pentagram / Apple keynote / top TED decks) designing slides for a university class presentation. You design ONE slide at a time as HTML + CSS on a fixed 1280×720 px canvas. There are NO templates: you decide the composition that best communicates THIS slide's message. Make it look like a skilled human designer made it — intentional hierarchy, generous whitespace, real photography used creatively, crisp diagrams — never a generic "title + bullet list + box".

DECK DESIGN SYSTEM (use it so all slides look like one family)
- Style: ${ds.name} — ${ds.mood}
- CSS variables: --bg ${ds.palette.bg}, --surface ${ds.palette.surface}, --ink ${ds.palette.ink}, --muted ${ds.palette.muted}, --primary ${ds.palette.primary}, --accent ${ds.palette.accent}, --accent2 ${ds.palette.accent2}. Use var(--…) for colours; tints via color-mix(in srgb, var(--primary) 20%, transparent) are fine.
- Fonts: headings font-family: var(--font-heading) (${ds.font.heading}); body var(--font-body) (${ds.font.body}).
- Recurring motif: ${ds.motif}
- Rules: ${ds.rules.join(" | ") || "consistent margins, one accent per slide"}
- Language of all slide text: ${brief.language}${brief.language === "Hindi" ? " (Devanagari script; keep technical terms in English where natural)" : brief.language === "Hinglish" ? " (Roman script)" : ""}.

TECHNICAL CONTRACT (the engine renders exactly what you write; the PPTX export reads it from the browser)
1. Output format, nothing else:
<slide>
<style>
/* CSS for this slide; every selector starts with .slide */
</style>
<!-- markup that goes inside <section class="slide"> (1280×720, position:relative, overflow:hidden, background var(--bg)) -->
</slide>
<notes>speaker notes = what the student SAYS while showing this slide: 3–5 natural spoken sentences in the deck's language that explain the content (never describe the design or your changes)</notes>
2. Layout freely, but build it so text can never collide: put each text group (title block, body, presenter details, captions) in its own positioned container with an explicit width, and flow the text inside it with flex/grid (column + gap) — never stack separately-absolute-positioned text lines on top of each other. Use absolute positioning for the containers, full-bleed images, decorative shapes and big background numerals. Leave ≥ 32px between a text container and any visual. Every element must stay fully inside 0–1280 × 0–720; text at least 56px from slide edges (full-bleed images/shapes may touch edges).
3. Text: every visible word inside h1–h4, p, li, span, strong, em, small, figcaption, blockquote, td or th. Never put text directly in a div. In SVG only short labels (≤ 4 words).
4. Type sizes (classroom projector!): slide title 44–64px (a title-slide hero may go to 88px if ≤ 7 words); key message 28–36px; body 24–30px; labels/captions ≥ 18px; citation markers and footnotes 14–16px. Line-height 1.25–1.45 for body. Max ~55 words of body text on a slide — if content is long, tighten wording, never shrink below these sizes. Give text boxes explicit widths so lines wrap nicely (max ~55 characters per line). Fill the canvas with purpose: the main visual should usually take 40–60% of the slide; avoid big dead areas and tiny centred elements.
5. Images: use ONLY the assets listed for this slide, as <img src="asset:ID" alt="…"> (object-fit: cover; set object-position deliberately) or background-image: url(asset:ID). No other URLs, no icon fonts, no emoji as icons, no JavaScript, no animations/transitions.
6. Use images like a designer — choose what serves the message, e.g.:
   • full-bleed photo with a gradient scrim (linear-gradient from var(--bg) to transparent) and text on the calm side;
   • split composition where the photo bleeds off one edge (top/right/bottom) at 40–55% width;
   • photo inside a clip-path shape (circle, ellipse, diagonal polygon, arch, rounded blob) with an offset outline stroke or solid accent shape behind it;
   • duotone: photo with filter: grayscale(1) contrast(1.1) and mix-blend-mode: multiply or screen over a var(--primary) panel;
   • tall vertical strip or wide cinematic band crop;
   • photo behind a huge translucent number or word;
   • framed print: thin border, soft shadow, slight caption.
   Never place a plain rectangular photo in a plain box. Never leave an empty placeholder box or "[Image]" text. Do not print image credits (the engine puts them on the References slide).
7. Diagrams & charts — use the engine's diagram component (it draws polished, on-brand nodes/arrows that exactly fill the box you give it; labels stay editable):
   <figure class="v3-diagram" data-kind="flow" style="position:absolute; left:620px; top:200px; width:600px; height:380px">
     <li><strong>Light source</strong> deuterium + tungsten lamps</li>
     <li><strong>Monochromator</strong> selects one wavelength</li>
     …
   </figure>
   data-kind: flow (steps with arrows; vertical automatically if the box is tall), cycle (circular loop), hub (first li = centre, rest around it), layers (stacked architecture layers, top to bottom), timeline, compare (first half of items = left column, second half = right), bars (bar chart: <li data-value="42" data-unit="%">Label</li> — ONLY when the VISUAL line below says "chart" and only with numbers that appear in the points; otherwise never draw a chart).
   Keep items to 3–6 with 1–4 word titles and ≤ 8-word descriptions. Give the figure a generous box (at least 480×300). Optional data-size="22" sets the label size.
   Use hand-written inline <svg> only for simple illustrations/icons/motifs (e.g. a cuvette, a wave, a molecule outline), never for charts.
   Hand-drawn SVG rules (the engine measures every label, line and arrow and sends the slide back if any rule is broken): every <text> label renders at 18px or more and sits fully inside the <svg> box; no two labels touch; no line, arrow or outline passes through any text (start and end arrows at box edges, route them around labels and headings); never draw a shape on top of a label. Prefer the v3-diagram component or HTML boxes laid out with flex/grid over absolutely-positioned SVG text.
8. Citations: when a point carries a marker like [2], put it right after that sentence as <sup>[2]</sup>. NEVER invent citations, author names, years, footers or sources. If you add a small source footer, use ONLY the exact source labels given for this slide.
8b. Truth: never invent numbers, percentages, chart values, dates or claims. A chart may only plot numbers that appear in the points. No generic clip-art icons (plus signs, random circles); if you draw an icon it must clearly depict the concept, otherwise use a number or a word. Every arrow must connect two things.
9. Contrast: text must be clearly readable on a classroom projector (ink on bg, or white on dark scrim). No light-grey text on white, no text over busy photo areas without a scrim.
10. Every card/panel must contain content. Use the motif and decorative shapes (rules, big faded numerals, gradient bands, geometric accents) behind content, never on top of text.
11. Keep it presentable: at most 4 points on a content slide (merge or cut), one key message, one main visual.
12. Never write placeholder text: no invented emails, phone numbers, websites, names or "Your Name" — only what you were given.${recipesEnabled() ? `

INSPIRATION: with each slide you get 2–3 example slides made by good designers for similar content. Study their technique (how the photo is treated, text kept inside flex/grid containers, generous type, one strong focal point). They are NOT templates: never copy their layout or sample text — invent the composition that fits YOUR content, palette and art direction.` : ""}`;
}

function assetLine(a: Asset): string {
  const ar = a.width / a.height;
  const shape = ar > 1.25 ? "landscape" : ar < 0.8 ? "portrait" : "square-ish";
  return `- asset:${a.id} — ${a.width}×${a.height} (${shape}, aspect ${ar.toFixed(2)}), average colour ${a.avgColor}, shows: ${a.description.slice(0, a.origin === "upload" ? 400 : 160)}${a.origin === "generated" ? " (AI illustration)" : a.origin === "upload" ? "" : " (real photo)"}`;
}

export function designerUserPrompt(deck: Pick<Deck, "brief" | "outline" | "assets" | "references" | "research">, slide: OutlineSlide, citeMap: Map<string, number>, inspiration: Recipe[] = []): string {
  const total = deck.outline.slides.length;
  const prev = deck.outline.slides[slide.n - 2];
  const next = deck.outline.slides[slide.n];
  const assets = deck.assets.filter((a) => a.forSlides.includes(slide.n));
  const factSrc = new Map(deck.research.facts.map((f) => [f.id, f.sources]));
  const pointLines = slide.points
    .map((p) => {
      const nums = Array.from(new Set((p.factIds || []).flatMap((id) => factSrc.get(id) || []).map((s) => citeMap.get(s)).filter(Boolean))) as number[];
      return `- ${p.text}${nums.length ? ` ${nums.map((n) => `[${n}]`).join("")}` : ""}`;
    })
    .join("\n");

  let roleBlock = "";
  if (slide.role === "title") {
    const fields = deck.brief.titleSlideFields;
    roleBlock = `THIS IS THE TITLE SLIDE. Make it striking and memorable (hero photo treatment if an asset is given).
Show: the title "${deck.brief.title}"${deck.brief.subtitle ? ` and subtitle "${deck.brief.subtitle}"` : ""}.
${fields.length ? `Also show these presenter details as a neat, readable block (label small/muted, value larger). Write each placeholder EXACTLY as given (e.g. ${token(0)}) where its value goes — the engine replaces it with the student's real text:\n${maskedFieldLines(fields)}` : "No presenter details were given — do not invent names."}`;
  } else if (slide.role === "references") {
    const credits = deck.assets.filter((a) => a.credit).map((a) => `${a.title.slice(0, 50)} — ${a.credit}`);
    roleBlock = `THIS IS THE REFERENCES SLIDE. List exactly these references in order, numbered as given (hanging indent, 14–17px, readable, two columns if more than 5). Do not change their text.
${deck.references.map((r) => `[${r.n}] ${r.text}`).join("\n") || "(no references)"}
${credits.length ? `Below them, a small "Image credits" block (12–13px, muted):\n${credits.join("\n")}` : ""}
Keep decoration minimal but on-brand (motif, title style).`;
  } else if (slide.role === "closing") {
    roleBlock = `THIS IS THE CLOSING SLIDE (Thank you / Questions). Elegant, confident, on-brand; echo the title slide composition (use the photo if one is given). Include one short line that recaps the deck's core idea, and the presenter name(s) if given: ${deck.brief.titleSlideFields.some((f) => f.label === "Presented by") ? `${token(deck.brief.titleSlideFields.findIndex((f) => f.label === "Presented by"))} (a placeholder the engine fills with the real text — write it exactly)` : "(none)"}. No question-mark clip-art.`;
  } else if (slide.role === "agenda") {
    roleBlock = `THIS IS AN AGENDA / OUTLINE SLIDE: show the sections as a designed sequence (numbered, timeline or path), not a plain bullet list.`;
  }

  const visual =
    slide.visual.kind === "diagram"
      ? `Draw a clear diagram (inline SVG or positioned HTML boxes + SVG arrows): ${slide.visual.idea || slide.keyMessage}`
      : slide.visual.kind === "chart"
      ? `Draw a clean chart (inline SVG) using only numbers from the points: ${slide.visual.idea || ""}`
      : assets.length
      ? `Use the image(s) below creatively as the slide's visual anchor.`
      : `No photo for this slide — make it strong with typography, a diagram, an icon-like SVG illustration or a big-number composition.`;

  const direction = (deck as any).design?.directions?.find((d: any) => d.n === slide.n)?.idea;
  const labels = Array.from(new Set(slide.points.flatMap((p) => (p.factIds || []).flatMap((id) => factSrc.get(id) || []))))
    .map((sid) => ({ n: citeMap.get(sid), src: deck.research.sources.find((s) => s.id === sid) }))
    .filter((x) => x.n && x.src)
    .sort((a, b) => a.n! - b.n!)
    .map((x) => `[${x.n}] ${shortLabel(x.src!)}`);
  return `Slide ${slide.n} of ${total} (show slide number as "${String(slide.n).padStart(2, "0")}" if the motif uses numbers) — role: ${slide.role}
ART DIRECTION for this slide (from the art director — follow its spirit): ${direction || "your call — make it distinctive"}
Neighbours (avoid repeating their composition): previous = ${prev ? `${prev.role} / ${prev.visual.kind}` : "none"}; next = ${next ? `${next.role} / ${next.visual.kind}` : "none"}.

${roleBlock}

TITLE: ${slide.title}
KEY MESSAGE (make this the most noticeable idea after the title): ${slide.keyMessage || "-"}
POINTS (you may tighten wording; keep meaning and citation markers):
${pointLines || "(none)"}

SOURCE LABELS you may use in a small footer: ${labels.join("; ") || "(none — no footer)"}

VISUAL: ${visual}
ASSETS FOR THIS SLIDE:
${assets.map(assetLine).join("\n") || "(none)"}

${inspiration.length ? `INSPIRATION (technique only — your slide must look different from these; sample text in them is not yours):\n${inspiration.map((r, i) => `--- Example ${i + 1}: ${r.name}. ${r.when}\n${r.html}`).join("\n\n")}\n--- end of examples\n\n` : ""}Design it now. Output only <slide>…</slide><notes>…</notes>.`;
}

function shortLabel(s: { kind: string; title: string; authors?: string[]; year?: number }): string {
  if (s.kind === "wikipedia") return `Wikipedia: ${s.title}`;
  const a = s.authors?.[0] ? s.authors[0].split(" ").slice(-1)[0] + (s.authors.length > 1 ? " et al." : "") : s.title.slice(0, 40);
  return `${a}${s.year ? ` (${s.year})` : ""}`;
}

export interface DesignOut {
  html: string;
  notes: string;
  provider: string;
  model: string;
  messages: Msg[];
}

/** A designer reply is usable when it holds a complete slide (the scheduler tries another model otherwise). */
export function usableDesign(text: string): boolean {
  return parseDesign(text).html.length > 200;
}

export function parseDesign(text: string): { html: string; notes: string } {
  let html = "";
  const m = text.match(/<slide>([\s\S]*?)<\/slide>/i);
  if (m) html = m[1];
  else {
    const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    html = fence ? fence[1] : text.includes("<style") || text.includes("<div") ? text : "";
    html = html.replace(/<notes>[\s\S]*?<\/notes>/i, "");
  }
  const notes = (text.match(/<notes>([\s\S]*?)<\/notes>/i)?.[1] || "").trim();
  html = html.replace(/<\/?slide>/gi, "");
  // a reply cut off by the token limit (e.g. a reasoning model that spent its budget thinking) leaves an
  // unclosed <style> or no markup at all — that is not a design, so it is treated as no answer
  if (!isComplete(html)) return { html: "", notes };
  return { html: sanitize(html), notes };
}

function isComplete(html: string): boolean {
  const opens = (html.match(/<style\b/gi) || []).length;
  const closes = (html.match(/<\/style>/gi) || []).length;
  if (opens !== closes) return false;
  const body = html.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  return /<(div|h[1-6]|p|section|figure|img|svg|ul|ol|table)\b/i.test(body);
}

/** Strip anything that could escape the canvas or run code. */
export function sanitize(html: string): string {
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .replace(/<section[^>]*class=["']?slide["']?[^>]*>/i, "<div class=\"slide-root\">")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/(src|href)\s*=\s*["']https?:\/\/[^"']*["']/gi, '$1=""')
    .replace(/url\(\s*["']?https?:\/\/[^)]*\)/gi, "none")
    .trim();
}

export async function designSlide(
  deck: Pick<Deck, "brief" | "outline" | "assets" | "references" | "research" | "design">,
  slide: OutlineSlide,
  citeMap: Map<string, number>,
  spread = 0,
  inspiration: Recipe[] = [],
  extraInstruction = "",
  pass: "draft" | "revision" = "draft"
): Promise<DesignOut> {
  const fields: Field[] = deck.brief.titleSlideFields || [];
  const messages: Msg[] = [
    { role: "system", content: designerSystemPrompt(deck.design, deck.brief) },
    { role: "user", content: designerUserPrompt(deck, slide, citeMap, inspiration) + (extraInstruction ? `\n\n${extraInstruction}` : "") },
  ];
  let reasoning = (process.env.V3_DESIGN_REASONING as any) || "medium";
  // Devanagari text costs ~3x the tokens of English
  let maxTokens = deck.brief.language === "Hindi" ? 16000 : 12000;
  for (let attempt = 0; attempt < 2; attempt++) {
    let r;
    try {
      r = await chat("design", messages, { temperature: 0.85, maxTokens, spread, timeoutMs: 300_000, label: `slide ${slide.n}`, reasoning, validate: usableDesign, pass });
    } catch (e: any) {
      // a reasoning model that spent the whole budget thinking: try once more with more room and less thinking
      if (attempt === 0 && /finish_reason=length/.test(String(e?.message))) {
        reasoning = "low";
        maxTokens = 24000;
        continue;
      }
      throw e;
    }
    const { html, notes } = parseDesign(r.text);
    if (html.length < 200) reasoning = "low"; // cut-off reply: think less on the retry
    if (html.length > 200) {
      const withFields = slide.role === "title" ? ensureFields(html, fields, missingPlaceholders(html, fields)) : html;
      return { html: fillPlaceholders(withFields, fields), notes: fillPlaceholders(notes || slide.notes || "", fields), provider: r.provider, model: r.model, messages: [...messages, { role: "assistant", content: r.text }] };
    }
  }
  throw new Error(`designer produced no usable HTML for slide ${slide.n}`);
}

export async function reviseSlide(prev: DesignOut, feedback: string, fields: Field[] = []): Promise<DesignOut> {
  // the slide goes back to an AI: student details become placeholders again
  const prevHtml = maskText(prev.html, fields);
  const messages: Msg[] = [
    ...prev.messages.slice(0, 2),
    { role: "assistant", content: `<slide>\n${prevHtml}\n</slide>\n<notes>${maskText(prev.notes, fields)}</notes>` },
    {
      role: "user",
      content: `The engine rendered your slide in Chromium and found these problems (positions are slide pixels: x from the left edge, y from the top, w×h):\n${maskText(feedback, fields)}\n\nFix every problem while keeping the design idea (you may rethink the composition if it is the cause). Remember the size limits and keep everything inside the 1280×720 canvas. Output the complete corrected <slide>…</slide><notes>…</notes> (keep the speaker notes as they were${fields.length ? `; keep every {{P…}} placeholder exactly as written` : ""}).`,
    },
  ];
  let r;
  try {
    r = await chat("design", messages, { temperature: 0.5, maxTokens: 12000, timeoutMs: 240_000, label: "revision", reasoning: (process.env.V3_DESIGN_REASONING as any) || "medium", validate: usableDesign, pass: "revision" });
  } catch (e: any) {
    if (!/finish_reason=length/.test(String(e?.message))) throw e;
    r = await chat("design", messages, { temperature: 0.5, maxTokens: 24000, timeoutMs: 300_000, label: "revision", reasoning: "low", validate: usableDesign, pass: "revision" });
  }
  const { html, notes } = parseDesign(r.text);
  if (html.length < 200) return prev;
  // details the slide carried before must still be there (the designer may have dropped a placeholder)
  const had = fields.map((_, i) => i).filter((i) => prevHtml.includes(token(i)));
  const filled = fillPlaceholders(ensureFields(html, fields, had.filter((i) => !html.includes(token(i)))), fields);
  // a layout revision does not change what the student says: keep the first draft's speaker notes
  return { html: filled, notes: prev.notes || fillPlaceholders(notes, fields), provider: r.provider, model: r.model, messages: [...messages, { role: "assistant", content: r.text }] };
}
