# Engine v3 — Research notes (DeckCraft AI)

Written 30 Oct 2026 while building Engine v3. Goal: an AI presentation engine where **the AI designs each slide freely** and the engine's job is to **render that design faithfully** on screen, in PDF and in an editable PPTX — tuned for academic decks presented in Indian university classes.

## 1. How existing tools do it

| Tool | How slides are made | How PPTX is made | Take-away for us |
|---|---|---|---|
| **Engine v2 (ours)** | 12 coded layouts, LLM fills fixed slots | pptxgenjs from slot geometry | Every deck looks like the same 12 boxes; any slot the LLM doesn't fill becomes an empty box. Root cause of "boxes, no images, giant headings". |
| **Presenton** (open source, Apache-2.0) | Fixed React/Tailwind layout templates with zod schemas; LLM picks a layout and fills JSON | Renders the layout, reads DOM boxes, writes PPTX | Same "fixed slots" idea as v2, only prettier templates. Good proof that *reading the rendered DOM* is the right way to get PPTX geometry. |
| **Gamma** (closed) | Card/"block" documents; AI writes content into a flexible flow layout; themes give coherence | Export is lossy (many users report PPTX looking different) | Coherence comes from a deck-level theme, not from fixed layouts. |
| **Slidev / reveal.js** | Markdown → HTML slides, designer writes CSS | Slidev's PPTX export is **screenshots** (not editable) | HTML/CSS is the most expressive slide language; screenshot-PPTX is faithful but not editable. |
| **Anthropic pptx skill (html2pptx.js)** | LLM writes one HTML file per slide (720pt×405pt body) | Playwright renders it; script walks DOM (`getBoundingClientRect` + computed style) and emits pptxgenjs text/shapes/images. **Rejects** CSS gradients, unwrapped text, background images on divs; forces rasterising those by hand. | The DOM-walk is the right core. Its weakness is that it *forbids* exactly the effects Nitish wants (gradients, blends, masks). |
| **dom-to-pptx** (npm, client-side) | Any DOM | Maps gradients/shadows/radii to native shapes where it can | Shows how far native mapping can go, but blend modes, masks, clip-paths, filters still have no PPTX equivalent. |

## 2. What PowerPoint (and pptxgenjs) can and cannot express

* pptxgenjs: text boxes with runs (font, size, colour, bold/italic/underline, char spacing, line spacing, bullets), ~200 preset shapes with **solid** fill + transparency, line/dash, shadow, rotation, images with `sizing: cover/contain/crop`, image transparency, `rounding` (circle only), charts, tables, speaker notes.
* **No gradient fills** in pptxgenjs, **no blend modes** (multiply/screen/overlay…), **no CSS masks / clip-path**, **no filters** (blur, grayscale, duotone), **no inline SVG with CSS**, and SVG images are unreliable (blank in older PowerPoint / WPS Office — the v2 "blank image" bug).
* **Fonts are not embedded** by pptxgenjs. PowerPoint substitutes missing fonts. `.fntdata` embedding is an obfuscated/EOT format with no maintained JS writer → out of scope for v3.0.

**Conclusion:** a pure "map every CSS feature to a PPTX object" exporter can never be faithful to a freely designed slide. We need a hybrid.

## 3. Chosen approach: "free HTML design → layered faithful export"

1. **The AI writes each slide as HTML/CSS** on a fixed 1280×720 canvas (16:9, = 13.333in × 7.5in, 1px = 0.75pt). No layout templates. It can use absolute positioning, flex/grid, full-bleed images, `mix-blend-mode`, `clip-path`/masks, gradients, strokes, inline SVG diagrams and charts.
2. **A deck-level design system** (palette, font pair, motif, spacing rules) is generated once by an Art-Director agent and injected as CSS variables, so 12 independently-designed slides still look like one deck.
3. **Headless Chromium is the single source of truth.** Screen preview, QA, PDF and PPTX all come from the *same* render.
4. **PPTX = layers measured from the render:**
   * **Text** → native, editable text boxes at the exact measured position, with computed font, size, weight, colour, alignment, line-height, letter-spacing (runs for bold/colour spans; bullets for list items).
   * **Plain images** that nothing decorative covers → native, croppable pictures (cropped exactly as `object-fit: cover` showed them).
   * **Everything else** (gradients, blended/masked/filtered images, strokes, SVG diagrams, decorative shapes, shadows) → rendered by Chromium with the text and native pictures hidden, and placed as a full-slide **background plate** PNG at 2× resolution. So the PPTX looks like the PDF, and all words remain editable.
   * Fonts: the design system pairs every web font with an Office-safe equivalent (e.g. Poppins→Century Gothic, Inter→Calibri, Playfair→Georgia, Noto Sans Devanagari→Nirmala UI) so PPTX text never falls back to a random font on a college PC. Text boxes get a little slack so a slightly wider fallback font doesn't wrap.
5. **QA loop**: DOM measurement catches overflow, text outside the canvas, overlapping text, tiny text, broken images, empty decorated boxes and placeholder text; deterministic fixes (shrink-to-fit) run first, then a vision model looks at the screenshot and the *same* designer agent revises (max 2 rounds).

Why not the alternatives: screenshot-only PPTX (Slidev) is faithful but not editable — students must be able to edit names/roll numbers. Native-only mapping (html2pptx / dom-to-pptx) is editable but forbids or mangles the creative image treatments Nitish asked for. The layered approach gives both.

## 4. Research correctness (academic)

* Sources (all free, no key): **Wikipedia REST** (`/page/summary`, search API, plain-text extracts), **OpenAlex** (`api.openalex.org/works?search=` — title, authors, year, venue, DOI, abstract as inverted index), **Crossref** (`api.crossref.org/works?query=`) as metadata fallback; **Semantic Scholar** used only if `SEMANTIC_SCHOLAR_API_KEY` is set (anonymous pool is heavily rate-limited).
* The Research agent may only state facts found in the fetched texts; every fact carries a source id (S1, S2…). Slides show citation markers ([1], [2]); the last content slide is **References** in a consistent style (APA-like: Author, Year, *Title*, Venue/Website, URL/DOI). Numbers not found in sources must not appear.
* Image credits (Wikimedia Commons / Openverse author + licence) are kept per image and printed in the References slide ("Image credits") and speaker notes.

## 5. Academic presentation conventions (Indian universities)

Common requirements seen in university/AICTE-style project-presentation templates:
* **Title slide**: project/topic title, institute + department logo/name, "Presented by" (student names + roll/registration numbers), "Under the guidance of" (guide name, designation), course/semester, session/date.
* **Project reviews (B.Tech/MCA)**: Introduction → Problem statement → Objectives → Literature review / existing system → Proposed system → Methodology / architecture (block diagram, DFD, flowchart) → Modules / tech stack (hardware & software requirements) → Results / screenshots → Conclusion → Future scope → References → Thank you / Q&A.
* **Subject seminars (B.Sc/M.Sc)**: Introduction → Principle/theory → Instrumentation/process → Applications → Advantages/limitations → Summary → References.
* References slide is expected (many faculty check it). Readable from the back of a classroom: body ≥ 20–24px on a 1280px canvas, ≤ ~6 bullets, one idea per slide, diagrams over paragraphs.
* Language: English by default; Hindi (Devanagari) and Hinglish (Roman script) supported — Devanagari needs Noto Sans Devanagari/Hind on screen and Nirmala UI in PPTX.

The Brief agent turns the user's request + any pasted format instructions into a structured brief (required slides, title-slide fields, reference style); the Outline agent must follow it.

## 6. Free-provider reality (Oct 2026) and how v3 copes

* Gemini free tier is now small on Flash models (tens of requests/day per model on many keys; `gemini-2.5-*` are being withdrawn for new keys — use `gemini-flash-latest` / `gemini-flash-lite-latest` aliases). Groq free: ~1k requests/day but low tokens-per-minute on big models. OpenRouter free: ~50 req/day without credit. Cloudflare Workers AI: 10k neurons/day.
* So v3 uses a **provider pool with per-provider rate limiters** (requests/min, concurrency, cool-down after 429) and **role-based routes with fallbacks** (`src/config/models.json → engineV3`). Designer calls run in parallel up to the pool's capacity; a 429 on one provider moves the call to the next.
* A 12-slide deck costs about 25–35 LLM calls (brief 1, research 1, outline 1, design system 1, image pick 1, designers 12, vision QA ~12 → batched, revisions ~3).

## 7. Images "like a designer"

* Real photos first: **Wikimedia Commons** API (bitmap files ≥ 900px, licence + author from `extmetadata`) and **Openverse** (CC-licensed). A vision model picks the relevant candidates from a contact sheet (Commons search is noisy).
* Generated images: **Cloudflare Workers AI Flux-1-schnell** for conceptual art when no real photo fits.
* Every image is downloaded and stored as a real JPEG/PNG (never SVG) with its aspect ratio and average colour, so the designer can choose full-bleed, duotone via blend modes, masked shapes, framed with strokes, split-screen, circular cut, image-behind-text with gradient scrim, etc.


## 9. What the test runs showed (30 Oct 2026)

Three sample decks were generated end-to-end (UV-Vis Spectroscopy · Smart Library Management System · प्रकाश संश्लेषण in Hindi). Findings that shaped the defaults:

- **The design model is the quality ceiling.** The same pipeline, prompts and QA loop produced *usable but plain* slides with `gpt-oss-120b` as designer (average vision-QA score ≈5.3/10: overlapping text, crude diagrams, empty areas) and *designer-quality* slides with a Kimi-class model (≈7–8/10). `models.json → engineV3.roles.design` therefore puts **Groq `moonshotai/kimi-k2-instruct-0905`** first, then Gemini Flash, then OpenRouter's free Kimi, and only then gpt-oss. Research/outline/QA roles run fine on gpt-oss-120b.
- **Streaming matters.** Long design generations (60–150 s) were cut by gateway timeouts (HTTP 524) until requests were switched to streaming (`stream: true`, default on; `V3_STREAM=off` disables).
- **Scholarly search needs a key under load.** Anonymous OpenAlex returns 429 when several decks run at once; the engine falls back to Crossref (ranked toward review/overview papers that match the topic). A free `OPENALEX_API_KEY` (or `OPENALEX_MAILTO`) is recommended for production.
- **Wikipedia relevance must use the specific topic, not the broad subject** — "Chemistry" matched "Chemistry (band)" in an early run; fixed (topic-word match + an off-topic title filter).
- **PPTX fidelity:** measured text boxes reproduce the Chromium layout closely in LibreOffice. Three fixes were needed: words broken across lines at hyphens are split where the browser broke them; semi-transparent text is pre-blended with the pixels underneath (LibreOffice clips transparent text); hidden-text plates use inline `!important` so a designer's own `!important` colour cannot leak text into the background image. Remaining drift comes only from font substitution when the Office twin font is missing on the viewing machine.
- **Wikimedia thumbnails:** bursts are rate-limited; downloads are capped at 4 in flight with 429 back-off, and the standard 1280 px thumbnail size is requested.
