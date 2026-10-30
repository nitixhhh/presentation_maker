# Presentation Engine v2: Rebuild Prompt

## 0. Scope
KEEP: Next.js app, Supabase schema + migrations, payment/admin flow, capacity gate, job queue + worker, multi-provider model router + quota tracker, API keys, models.json.
REPLACE: the whole generation + rendering core ("engine"). Do not patch the old engine; build the new one beside it and switch the worker over once the acceptance tests in section 12 pass.

## 1. Why v1 failed (every item below must be fixed)
1. LLMs were allowed to decide layout, geometry, colors and fonts. Result: content outside the frame, flat single-color decks.
2. No text measurement. Also Google Fonts are NOT embedded in PPTX, so on the viewer's machine a fallback font changes the metrics and text overflows.
3. Remote images were not downloaded, validated, cropped and embedded. Result: missing images, and no fallback when a fetch failed.
4. Stages ran sequentially and every AI worked blind. The "merger" only concatenated outputs. No single mind owned the whole deck.
5. QA looked at JSON/HTML, never at the real exported PPTX.
6. One default layout was reused, so decks looked the same every time.

## 2. Principles
- LLMs decide CONTENT and pick NAMED OPTIONS from enums. Code decides geometry, colors, fonts, spacing, decoration. LLMs never output coordinates, hex colors, font names, CSS/HTML or URLs.
- One Director owns the whole deck through a shared Blueprint. Every other agent is a narrow specialist that receives the Blueprint.
- Everything deterministic is code (it costs zero free-tier tokens).
- Verify the real output: render the exported PPTX to images and look at it.
- Parallel by default, with error isolation per task.
- Free-tier budget: at most 16 LLM calls per presentation.

## 3. Pipeline (DAG)
```
brief
 -> [A] Director.Plan            (1 LLM call: thesis, arc, mood, slide roles, research queries)
 -> [B] Research                 (parallel web searches, cached, max 5; 1 Researcher call builds the fact sheet)
 -> [C] Director.Finalize        (1 LLM call: final Blueprint = key message + facts per slide)
 -> [D] in parallel:
        D1 DesignSystem generator (code, seeded)
        D2 Layout planner          (code, seeded, variety rules)
 -> [E] SlideWriter batches      (parallel, 3-4 slides per call; output slot content + visual spec)
 -> [F] Asset pipeline           (parallel: photos, charts, diagrams, icons, with fallbacks)
 -> [G] Scene graph assembly     (code)
 -> [H] Render: HTML, PDF, PPTX (editable), PPTX (exact-look images)
 -> [I] QA: code checks -> render real PPTX via LibreOffice -> vision critic on contact sheets (parallel)
 -> [J] Director.Fix             (1 LLM call: returns fix ops) -> code applies ops -> re-render only affected slides (max 2 rounds)
 -> package + save design signature
```
Typical LLM calls: Director 2 + Research 1-2 + Writers 3 + Critic 2-3 + Fix 1-2 = about 12-14.

## 4. Canvas and layout system
- Canvas: 13.333 x 7.5 in (16:9). Safe area: 0.6 in left/right, 0.5 in top/bottom. 12-column grid, 0.2 in gutter. Nothing may extend outside the safe area except intentional full-bleed backgrounds/photos.
- One geometry source (the Scene Graph). All emitters (HTML, PDF, PPTX) read the same geometry so they always agree.
- Layouts live in code (TypeScript), one file each:
```ts
type Layout = {
  id: string; roles: Role[]; density: 'low'|'med'|'high';
  slots: Record<string, TextSlot | ListSlot | ImageSlot | ChartSlot | DiagramSlot | IconSlot>;
  decorations: (ds: DesignSystem, rng: RNG) => Shape[];
  variants: number; // geometry flips: image left/right, dark/light, alignment
}
// TextSlot: { rect, role:'title'|'body'|'caption'|'stat'|'label', minPt, maxPt, maxChars, maxLines, align }
```
- Start with 12 layouts, grow to 30+: cover-fullbleed, cover-split, section-bignumber, statement, stat-hero, three-cards, icon-grid-4, bento, image-left, image-right, photo-overlay, timeline, process-steps, cycle, comparison, pros-cons, matrix-table, chart-focus, chart-insights, diagram-focus, code-focus, agenda, key-takeaways, cta, pyramid, funnel, roadmap, quote-portrait, gallery-3, big-quote.
- Every layout must contain at least 2 non-text visual elements (shapes, image, icon badge, big numeral, pattern, gradient). Plain "title + bullets" is forbidden.
- Native diagram components (process, cycle, pyramid, funnel, timeline, matrix) are drawn by code from simple JSON lists. They are editable in PPTX and more reliable than LLM-written Mermaid. Use Mermaid only for complex flowcharts or sequence diagrams.
- Text fitting: measure with fontkit (web mode: real font files; PPTX mode: metric-compatible fonts). Algorithm: shrink from maxPt to minPt; if it still does not fit, return `needs_shorten` and let the fix loop shorten it. Never allow overflow.
- Layout planner rules (seeded RNG): no identical layout twice in a row; the same layout at most 2 times per 10 slides; first slide is a cover, last is takeaways or cta; a section divider about every 5 slides in long decks; at least one image-led and one data/diagram slide when the topic allows; the Director may veto a choice.

## 5. Design System generator (code, no LLM)
Input: seed, mood (enum from Director), language. Output tokens:
```
styleFamily, palette{bg,bgAlt,surface,primary,secondary,accent,text,textMuted,onPrimary,gradient[c1,c2,angle]},
isDark, fonts{heading,body,mono,pptxHeading,pptxBody}, shape{radius,stroke,shadow},
bgTreatment, decorSet, imageTreatment, iconStyle
```
- Style families (start with 10): editorial-serif, bold-geometric, glass-gradient, bento-grid, neo-brutalist, soft-pastel-organic, dark-tech-neon, minimal-swiss, retro-print, magazine-photo-led. Each family defines its own shape language, backgrounds (solid, gradient, mesh, pattern, noise), decoration primitives (accent bars, circles, blobs, diagonal cuts, dot grids, big numerals), image treatments (rounded mask, duotone, circle crop, full-bleed with gradient scrim, framed), and divider styles.
- Palette algorithm: base hue from the mood plus seed; pick a harmony scheme (analogous, complementary, triadic, split-complementary, mono-plus-accent); derive roles in OKLCH with fixed lightness ladders; enforce WCAG contrast (>= 4.5 for body text, >= 3 for large text).
- Multi-color rule: across a deck at least 4 distinct palette roles must be visibly used. Each slide rotates its accent role and picks a background variant from [bg, bgAlt, primary-tinted, gradient]. This keeps the deck coherent but never monotone.
- Fonts: use at most 2 families per deck. HTML/PDF use Google Fonts (for Hindi use Noto Sans Devanagari or Hind). PPTX can only use fonts installed on the viewer's machine, so each web font maps to a safe PPTX font: Arial, Calibri, Cambria, Georgia, Trebuchet MS, Verdana, Times New Roman (Hindi: Nirmala UI or Mangal).
- Uniqueness: signature = hash(styleFamily + palette hues + font pair + layout sequence). Check the `design_history` table (signature is unique); if taken, reseed and retry (max 5); on success insert the row.

## 6. Asset pipeline (code, parallel, with fallbacks)
- Images: Pexels first (UNSPLASH_ENABLED=false by default because its hotlink rules conflict with embedding in exports). For each slot fetch about 8 candidates, then pick deterministically: orientation matches the slot, minimum resolution, not already used in this deck, dominant color harmonizes with the palette (sharp stats or node-vibrant).
- Download server-side (timeout 10 s, size limit 15 MB). Verify it decodes, crop to the slot aspect ratio with sharp (`strategy.attention`), apply the style's image treatment, save to Storage, and embed as a LOCAL FILE or base64. Never leave a remote URL in an export.
- Fallback chain: Pexels -> (Unsplash if enabled) -> AI-generated image (Cloudflare FLUX) -> procedural SVG art (gradient mesh / blob composition drawn from the palette). A slot must NEVER be empty.
- Icons: Lucide SVG recolored from the palette, rasterized with sharp (256 px PNG) for PPTX.
- Charts: ECharts server-side render themed with the palette -> PNG; only with real numbers from the fact sheet.
- Credit photographers in a small caption or in the notes slide.

## 7. Renderers and exports
- Scene Graph (JSON) -> emitters. HTML stage 1280x720 scaled by CSS transform. PDF via Playwright at 13.333x7.5 in. PPTX via pptxgenjs using native shapes, text and images.
- Offer two PPTX downloads: "Editable" (native, safe fonts) and "Exact look" (each slide rendered to a 2x PNG, placed full-slide, with speaker notes). Also offer PDF and HTML. Tell the user plainly that custom fonts only appear exactly in PDF, HTML and "Exact look".
- Worker image must install fonts: Carlito (Calibri metrics), Caladea (Cambria), Liberation Sans/Serif (Arial/Times), plus the Google font files used by HTML/PDF.

## 8. QA and fix loop (checks the REAL output)
1. Scene-graph checks (code): every shape inside the safe area; no overlap between text slots; body >= 14 pt (captions >= 11 pt); contrast ok; images decoded and not blank; max 2 font families; no consecutive repeated layouts; at least 2 visual elements per slide; at least 4 palette roles used in the deck.
2. Render the exported PPTX with LibreOffice headless -> PDF -> PNG (pdftoppm). Also read the PDF text positions (pdfjs-dist) and fail any text glyph that lies outside the page or outside its slot rect.
3. Vision critic: build contact sheets of up to 6 slides per image (about 1600 px wide) and send them in parallel. Rubric and vocabulary are in Appendix A.3.
4. Director.Fix receives the defects and returns ops from this vocabulary only: `shorten{slide,slot,targetChars}`, `swap_layout{slide,layoutId}`, `replace_image{slide,newQuery}`, `change_variant{slide}`, `split_slide{slide}`. Code applies the ops, re-renders only affected slides, then re-checks. Maximum 2 rounds, then ship the best version.

## 9. Parallel scheduler
- Tasks form a DAG; run with `Promise.allSettled` so one failure never kills the job.
- Per-provider semaphore and token bucket (RPM) read from models.json; daily and monthly quota from `provider_usage`; fallback via the router; skip a provider at 80% of its limit.
- Write progress to `jobs.progress` ({stage, percent, message}) for the live UI. Target under 3 minutes typical.
- If every provider is out of quota, set the job to `waiting_quota` with `run_after` at the next reset (never lose a paid order).

## 10. Prompt kit rules (for every agent)
- Each agent gets: ROLE, INPUT, OUTPUT JSON schema (zod), RULES/DON'Ts, 2 few-shot examples, SELF-CHECK line. Use JSON mode or schema-constrained output where the provider supports it; validate with zod; on failure one repair prompt, then fallback model.
- Temperature: 0.2-0.4 for structured output; 0.7-0.9 only for Director.Plan's creative choices.
- Do not rely on native tool calling (free models vary): use the own `{tool,args}` JSON loop where needed.
- Cache by prompt hash. Log every call to `llm_calls`.

## 11. Build phases (do them in order; stop after each and show me the result)
- V2-0: Engine WITHOUT any AI. Scene graph, 12 layouts, design system generator, HTML/PDF/PPTX emitters, code QA, LibreOffice render check. Feed fixture content for 5 sample topics and produce contact sheets. I will review the look before you connect any LLM.
- V2-1: Director + SlideWriter + scheduler replace the fixtures.
- V2-2: Asset pipeline, native diagrams, charts.
- V2-3: Vision critic + fix loop.
- V2-4: Grow to 30 layouts and 10 style families; tune.

## 12. Acceptance tests (automated, run for 5 different briefs, 10 slides each)
- 0 shapes outside the safe area; 0 empty image slots; PPTX opens without a repair prompt (load with python-pptx and convert with LibreOffice).
- Every slide has >= 2 non-text visual elements; >= 4 palette roles used per deck; no layout repeated back-to-back.
- Two runs with different seeds give different signatures.
- Vision critic: no slide below 7/10 after the fix loop.
- At most 16 LLM calls and at most 4 minutes per deck.

## 13. Never do
No LLM-written HTML/CSS/slide code. No coordinates, colors or font names from an LLM. No remote image URLs in an export. No unbounded retries. No `Promise.all` without error isolation.

---

# Appendix A: agent system prompts (starting versions, tune after V2-3)

## A.1 Director.Plan
```
You are the Creative Director and the only owner of this presentation. You see the whole deck; specialists will see only what you give them.
INPUT: brief {topic, audience, tone, language, slideCount N, toggles}, seed.
OUTPUT (JSON only, schema provided):
- thesis: one sentence the audience must remember.
- arc: one of [problem-solution, story, explainer, pitch, report, tutorial, comparison].
- mood: one of [corporate, playful, elegant, bold, calm, techy, warm, editorial] and a reason in 15 words or fewer.
- slides: exactly N items {n, role, keyMessage, visualIntent, density, researchNeed}.
  role in [cover, agenda, section, statement, stat, comparison, process, timeline, data, diagram, quote, gallery, takeaways, cta].
  visualIntent in [photo, chart, diagram, icons, bigNumber, quote, none].
- researchQueries: at most 4 web queries that cover the facts you need.
RULES:
- keyMessage is a CLAIM of at most 14 words ("Costs fell 40% since 2020"), never a topic label ("Costs").
- No more than 2 consecutive slides share the same role or the same visualIntent.
- At least ceil(N/3) slides use a visualIntent other than none.
- First slide is cover; last is takeaways or cta.
- Never output colors, fonts, layout names, or coordinates.
SELF-CHECK: count the slides, check every enum value, check the JSON is valid.
```

## A.2 SlideWriter
```
You write slide content for specific slots. You do not design.
INPUT: blueprint summary {thesis, arc, tone, language} and, for each assigned slide: role, keyMessage, facts[], layout slot spec (name, kind, maxChars or maxItems), visualIntent.
OUTPUT (JSON only): per slide {n, slots:{...}, visual:{kind, query, altQueries[2], chart?, diagram?, icons?}, notes}.
RULES:
- Respect every maxChars and maxItems exactly. Count characters.
- Titles are claims (verb + result). Body text is short fragments, never paragraphs.
- Numbers must come from facts[]; if no fact exists, do not invent a number.
- visual.query: 2-5 concrete nouns describing a photographable scene (no abstract words, no brand names, no people names).
- chart only when facts[] contain real numbers; otherwise use a diagram or icons.
- Write in {language}; keep proper nouns as they are.
- No markdown, no emojis, no colors, no fonts, no coordinates, no URLs.
SELF-CHECK: every slot filled, every string within its limit, JSON valid.
(Add 2 few-shot examples here before shipping.)
```

## A.3 VisionCritic
```
You are a strict presentation design reviewer. You receive a contact sheet of up to 6 slides labeled S1..S6, rendered from the REAL exported file.
For each slide give scores 0-10 for: legibility, composition, visual_richness, hierarchy, polish.
List defects using ONLY this vocabulary: text_clipped, text_overflow, overlap, off_frame, image_missing, image_irrelevant, low_contrast, too_empty, too_dense, monotone, misaligned. Each defect has {type, where, severity 1-3}.
OUTPUT JSON only: [{slide:"S3", scores:{...}, defects:[...], verdict:"ok"|"fix"}].
RULES: do not suggest redesigns, colors or fonts. Be harsh: text on a flat background with no imagery or shapes scores at most 4 for visual_richness. Verdict is "fix" if any score is below 7 or any severity-3 defect exists.
```

## A.4 Director.Fix
```
You are the Creative Director fixing defects. INPUT: the Blueprint, the slides' current layout and slot text, and the critic's defect list.
OUTPUT JSON only: a list of ops, each from [shorten{slide,slot,targetChars}, swap_layout{slide,layoutId from the allowed list for that role}, replace_image{slide,newQuery}, change_variant{slide}, split_slide{slide}].
RULES: smallest change that removes the defect; never change a slide's key message; at most 8 ops per round; never invent facts.
```
