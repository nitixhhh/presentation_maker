# Engine v7 — free-form design (prototype)

No templates, no layout list, no slide "types". Every deck gets its own concept and every slide is a blank
1920x1080 canvas that the AI designs for its own idea, as one standalone HTML/CSS/inline-SVG document.

## Steps
1. **content.ts** — brief + research (engine v3 brief/research, shared deepen step, v5 scholarly boost = real facts
   and sources), then the **story**: what each slide says (one idea, real numbers, fact ids). Strong chain ("art").
2. **concept.ts** — the art director: brainstorms three directions, picks one that differs from the last 8 decks made
   on the site (`v7-recent-concepts.json` in the data dir), writes the art direction (palette, Google Fonts, motif,
   image style) and a storyboard: per slide the visual that explains the idea + a composition sketch + an optional
   AI image (max 5 per deck). Nothing is chosen from a list.
3. **images.ts** — FLUX.2 klein 4B (Cloudflare Workers AI) in the deck's one image style; every picture is checked by
   a vision model for painted text; a failed/quota-hit/texty picture → one retry → a checked real photo (Wikimedia
   Commons) → or no picture (the slide is drawn instead). Frames/captions are stripped from the image prompt.
4. **slide.ts** — the designer: one call per slide returns a complete HTML document. Shared inputs only: the concept,
   the fonts, the images. The references slide leaves `<!--REFS-->` where the engine inserts the real citations
   (the AI never writes references).
5. **render.ts + qa.ts** — headless Chromium renders each slide (network closed except the deck's files and Google
   Fonts). Before measuring, the engine repairs what it can itself (no AI call): text under 22px is raised to 22px,
   text poking up to 90px past the safe margin is nudged back inside. Then in-page measurements — all HARD failures
   that force a fix round and cost 1.5 score points each: text under 22px, text cut off / clipped / touching the
   edge, text overlapping text, svg labels or diagram parts cut off by their viewBox or the slide, label text wider
   than the box behind it, text boxes running off the slide, empty framed boxes, a large flat empty area (pixel scan,
   >=38% of the slide; >=26% is a soft note for the reviewer), a planned drawing that is missing, sketch/roughen SVG
   filters, and a running header/footer repeated on 3+ slides (compared across the deck, digits ignored). A vision
   model reviews the screenshot. Fix rounds go to slides with hard failures first, then the lowest scores; a fix
   starts from the best version so far, and the best-scoring version is always the one kept.
   Gemini budget: every Gemini Flash request is counted (`V7_GEMINI_PER_MODEL`, `V7_GEMINI_BUDGET`,
   `V7_GEMINI_LEDGER`); drafts are reserved first, fixes use what is left. `V7_ONLY=2,7 V7_ONLY_MODE=fix` fixes
   listed slides starting from the saved version (which stays the one to beat).
6. **export.ts** — vector PDF printed by Chromium (one page per slide, merged with pdf-lib) + PPTX with one
   full-slide picture per slide and the slide text/notes in the speaker notes.

`fonts.ts` resolves any Google Fonts family the concept names and inlines the @font-face CSS (unknown family →
safe fallback).

## Run (prototype)
    tsx scripts/v7-design.ts '{"topic":"Bayes\' Theorem","slideCount":9}' /tmp/v7/bayes
Env: provider keys as for the site; `ENGINE_V3_ROUTES` can pin the "art", "design" and "vision" chains;
`V7_CONCURRENCY` (slides in parallel, default 3), `V7_FIX_ROUNDS` (default 2), `V7_DEBUG_DIR` (keeps unusable
model replies), `V7_REUSE=1|story` (re-design a saved deck without new research).

Helpers: `scripts/v7-measure.ts <dir>` re-measures saved slides (no AI); `scripts/v7-finalize.ts <dir> <log>` picks
the best round per slide of a stopped run with the current checks and exports.

Not wired into the site yet (no route, no plan) — prototype only.
