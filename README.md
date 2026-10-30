# DeckCraft AI — Autonomous Multi-Agent Presentation Maker

An autonomous full-stack AI presentation maker built with Next.js (App Router), TypeScript, Tailwind CSS, Playwright render QA, intelligent multi-agent model routing, and a deterministic code-only presentation rendering engine (Engine v2).

---

## Architecture & Design Overview

### 1. Web Application Aesthetic
- **Warm Editorial Minimalist UI**:
  - Background: `#FBF8F3` (Warm cream canvas)
  - Surface Cards: `#FFFFFF` with warm hairline borders (`#E8E2D5`) and soft ambient shadows (`0 2px 20px rgba(0,0,0,0.04)`)
  - Primary Accent: `#C15B3E` (Warm terracotta) with `#A84E34` hover state
  - Typography: Editorial serif headings (`Playfair Display`) paired with clean modern Apple-like sans-serif body text (`Inter`) and monospace metrics (`JetBrains Mono`)
  - Smooth interactive controls: `rounded-2xl` Apple-style buttons, custom styled range sliders, warm hairline inputs, and responsive layout
  - Fully responsive, mobile-first design with accessible contrast ratios (WCAG AA).

### 2. Engine v2 (V2-0 Foundation & V2-1/V2-2 AI Agents Pipeline)
Engine v2 is a ground-up declarative rendering engine that eliminates LLM hallucinations in slide design and geometry:
- **Canvas Specification**: Fixed 13.333" × 7.5" (16:9) canvas, 12-column grid system (0.2" gutters), and a strict 0.6" left/right and 0.5" top/bottom safe area (`SAFE_AREA`).
- **SceneGraph Intermediate Representation**: Declarative JSON tree representing all slide elements (`RectShape`, `TextShape`, `BulletListShape`, `ImageShape`, `IconShape`, `ChartShape`, `DiagramShape`, `BigNumberShape`).
- **AI Director Agent (`src/engine/agents/director.ts`)**:
  - Analyzes the presentation brief, audience, and narrative arc.
  - Dynamically plans slide roles and selects varied layout structures using deterministic seeded PRNG.
- **AI SlideWriter Agent (`src/engine/agents/slideWriter.ts`)**:
  - Fills slot schemas with concise, high-impact copywriting, structured KPI metrics, and topic-tailored diagram specifications.
- **Dynamic AI Vector Diagram Builder (`src/engine/diagrams/dynamicDiagramBuilder.ts`)**:
  - Eliminates rigid, repetitive diagram templates.
  - Generates topic-customized process flows, layered architecture stacks, and 2×2 matrices from AI topological specs.
  - Emits native vector shapes (containers, badges, icons, connecting arrow lines) that are razor-sharp and fully editable in PowerPoint (`.pptx`).
- **Free Diffusion AI Image Generator (`src/engine/assets/imageGenerator.ts`)**:
  - Powered by Cloudflare Workers AI hosting Black Forest Labs' **Flux 1 Schnell** and **SDXL Lightning** (free tier: 10,000 neurons daily).
  - High-resolution base64 JPEG synthesis delivered directly into SceneGraph intermediate representations for HTML, PPTX, and PDF emitters.
  - Secondary fallback to Gemini 2.5 Flash 1280x720 vector SVG generation with authentic topic geometry and linear gradients.
- **Resilient Multi-Provider LLM Routing & Instant Failover (`src/lib/ai/`)**:
  - Automatically routes tasks across Google AI Studio (`gemini-2.5-flash`) and Groq (`openai/gpt-oss-120b`).
  - Implements instant active failover upon 429 quota exhaustion or high-demand spikes without dropping to static mock templates.
- **12 Code-Only Layout Definitions**:
  - `cover-fullbleed`: Hero image with text scrim overlay
  - `cover-split`: Split layout (half image, half text)
  - `section-bignumber`: Large metric stat callout with supporting caption
  - `statement`: Large quote or bold claim
  - `stat-hero`: 3-metric KPI hero row
  - `three-cards`: 3-column card grid with icon headers
  - `icon-grid-4`: 2×2 or 4-row feature grid with icons
  - `image-left`: Left-aligned photo with bullet points
  - `image-right`: Right-aligned photo with bullet points
  - `key-takeaways`: Summary bullets list
  - `closing-cta`: Final call-to-action slide
  - `agenda`: Table of contents / session roadmap
- **Deterministic Design System Generator**:
  - OKLCH color space math with guaranteed WCAG AA/AAA contrast ratios
  - 10 curated style families (`editorial-serif`, `bold-geometric`, `glass-gradient`, `bento-grid`, `neo-brutalist`, `soft-pastel-organic`, `dark-tech-neon`, `minimal-swiss`, `retro-print`, `magazine-photo-led`)
  - Seeded PRNG (`mulberry32`) guaranteeing identical output for identical seeds and distinct design signatures for different seeds.
- **Strict Code-Only QA Validator (`sceneGraphChecks.ts`)**:
  - Zero tolerance for shapes outside the safe area (except designated full-bleed backgrounds/overlays)
  - Layout repetition guard (no identical layouts back-to-back, max 2 occurrences per 10 slides)
  - Minimum typography sizes (body ≥ 14pt, caption ≥ 11pt)
  - Visual element count enforcement (≥ 2 non-text visuals per slide)
  - Color palette diversity validation (≥ 4 distinct roles per presentation).
- **Multi-Target Emitters**:
  - HTML Emitter: 1280×720 CSS-transformed slideshow with keyboard navigation and fullscreen support
  - PPTX Emitter: Native shapes, PPTX-safe cross-platform font fallbacks, and editable text
  - PDF Emitter: Multi-page vector PDF via headless Chromium.

### 3. Presentation Design Engine (v1 Legacy / Hybrid)
Every presentation generated is visually unique and richly formatted—never a generic "title + bullet" deck:
- **10 Curated Color Palettes**:
  - Midnight Cyber, Obsidian Emerald, Velvet Amethyst, Slate Minimalist, Warm Terracotta, Executive Navy & Gold, Editorial Cream & Sand, Crimson Noir, Aurora Borealis, Solar Citrus.
- **8 Google Font Pairs**:
  - Paired heading/body typography with full Devanagari support for English, Hindi, and Hinglish presentations.
- **25+ Bespoke Layout Engine**:
  - Hero, Split Content-Image, Big Number Callout, 3-Card Grid, 4-Card Grid, Comparison (Pros/Cons), Horizontal Timeline, Vertical Process, Quote Highlight, Full-Bleed Visual, Chart Visualization, Mermaid Diagram, Code Walkthrough, Matrix 2x2, Problem-Solution, Key Takeaways, and more.
- **Visual Element Requirement**:
  - Every slide contains a dedicated visual component (ECharts data graphic, Mermaid diagram, syntax-highlighted code block, stat callout, or icon grid).
- **Layout Repetition Guard**:
  - No two consecutive slides share the same layout pattern.

### 4. Multi-Agent Pipeline & Live Streaming Console
The generation workflow is divided among specialized sub-agents orchestrated by an Owner agent:
1. **Researcher Agent**: Analyzes topic, target audience, and market context using Google AI Studio (`gemini-2.5-flash`).
2. **ArtDirector Agent**: Generates a distinct "Design DNA" (palette, typography, layout sequence, visual style) from topic and seed.
3. **SlideWriter Agent**: Drafts punchy headlines, word-capped body points, and full presenter speaker notes.
4. **DiagramCodeSpecialist Agent**: Synthesizes data charts (ECharts) and architecture flowcharts (Mermaid) via GroqCloud (`openai/gpt-oss-120b`).
5. **Deterministic QA**: Verifies word counts, WCAG AA contrast ratios, empty space, and layout sequences.
6. **Playwright QA**: Headless Chromium 1920x1080 viewport rendering to detect text overflow before deck delivery (0 overflow guarantee).

### 5. Real-Time Streaming Console
- Live Server-Sent Events (SSE) streaming endpoint (`/api/pipeline/stream`).
- Embedded terminal displays real-time agent execution, millisecond timestamps, active model identifiers, and progress percentages.

### 6. Admin Direct Mode & Ephemeral In-Memory Storage
- **Admin Direct Mode**: Instant generation bypassing payment gates for testing and development.
- **Ephemeral Storage**: Supabase is turned off during testing; state resides entirely in memory with zero user data saved to disk or external databases.

### 7. Multi-Format Exporters
- **PowerPoint (PPTX)**: Native `.pptx` generation with custom layouts, colors, shapes, and speaker notes via `pptxgenjs`.
- **High-Resolution PDF**: Clean 16:9 PDF export generated via Playwright headless rendering.
- **Standalone HTML Slideshow**: Standalone responsive 16:9 slideshow with interactive charts, keyboard navigation, and a collapsible speaker notes drawer.

---

## Getting Started

### 1. Install Dependencies
```powershell
npm install
npx playwright install chromium
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your provider keys:
```powershell
Copy-Item .env.example .env.local
```

### 3. Run Test Suites
- **Engine v2 (V2-0 Foundation) Test Suite**:
  ```powershell
  npx tsx scripts/test-v2-engine.ts
  ```
- **Pipeline Test (v1)**:
  ```powershell
  npx tsx scripts/test-pipeline.ts
  ```
- **Payment & Capacity Test**:
  ```powershell
  npx tsx scripts/test-phase2.ts
  ```

### 4. Start Development Server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.


---

## Engine v3 — AI-designed slides (default in the UI)

Engine v3 drops fixed layouts. Every slide is **designed freely by an AI designer as HTML/CSS on a 1280×720 canvas** (full-bleed photos, blend modes, masks, strokes, gradients, SVG diagrams), guided by a deck-level design system so the whole deck stays coherent. The engine's job is to **render exactly what the AI designed** — on screen, in PDF and in an editable PPTX. v2 (`src/engine`) is untouched and still selectable in the UI.

Research notes and reasoning: [`docs/ENGINE_V3_RESEARCH.md`](docs/ENGINE_V3_RESEARCH.md).

### Pipeline (`src/engine-v3`)

| Step | File | What it does |
|---|---|---|
| Brief agent | `agents/brief.ts` | Understands the goal, deck type (seminar / project review / …), class level, slide count, language (English / Hindi / Hinglish), the university format the user typed, and the title-slide details (name, roll no., guide, department — printed exactly, never invented). |
| Research agent | `agents/research.ts`, `research/sources.ts` | Real sources from **Wikipedia**, **OpenAlex** and **Crossref** (free, no key; **Semantic Scholar** if `SEMANTIC_SCHOLAR_API_KEY` is set). Extracts 25–45 facts, each tied to a source. References are formatted by code (APA 7 / IEEE), not by the LLM. |
| Story agent | `agents/outline.ts` | Slide-by-slide story following the required sections; every point carries fact ids → citation markers `[n]`; decides what each slide should *show* (photo / generated / diagram / chart / none). |
| Images | `assets/images.ts` | Real photos from **Wikimedia Commons** + **Openverse** (licence + author kept), a vision model picks the right one from a contact sheet, **Cloudflare Flux** for conceptual images. Always stored as real JPEGs. Credits go on the References slide and in speaker notes. |
| Art director | `agents/artDirector.ts` | One design system per deck: palette (contrast-checked), font pair (each web font has an Office-safe twin for PPTX), motif, rules, and a distinct composition idea for every slide. |
| Designers (parallel) | `agents/designer.ts` | One AI designer per slide, all in parallel through the rate-limited provider pool. Free HTML/CSS — no templates. |
| Visual QA loop | `qa/inspect.ts`, `qa/vision.ts`, `render/domScripts.ts` | Each slide is rendered in headless Chromium. DOM measurement catches text outside the canvas, clipped/overlapping/covered text, tiny text, low contrast (measured on the real pixels), broken images, placeholders, sparse slides. Clipped text is auto-fitted; then a vision model critiques the screenshot and the same designer revises (max 2 rounds; best version kept). |
| References slide | `agents/referencesSlide.ts` | Built by the engine so citations are always exact. |
| PDF | `export/pdf.ts` | Chromium prints each slide exactly as rendered (vector text), merged with pdf-lib. |
| PPTX | `export/pptx.ts` | Built **from the rendered DOM**: every text block becomes a native editable text box at its measured position (fonts, sizes, colours, line breaks as rendered); plain photos become native pictures (cropped exactly like on screen); everything PowerPoint can't express (gradients, blends, masks, SVG diagrams, shadows) becomes a 2× background plate. The PPTX looks like the PDF and stays editable. |

### API

* `POST /api/v3/generate` — Server-Sent Events (`progress`, `complete`, `error`). Body: `{ topic, audience, slideCount, language, purpose?, formatNotes?, presenter?: { names, rollNo, department, institute, guide, course }, imageSource?: "stock" | "ai" | "none", styleHint? }`
* `GET /api/v3/deck/:id` · `GET /api/v3/deck/:id/slide/:n` (HTML) · `GET /api/v3/deck/:id/asset/:file` · `GET /api/v3/deck/:id/export?format=pdf|pptx|html`
* CLI: `npx tsx scripts/v3-generate.ts request.json out-dir` → PDF + PPTX + PNG of every slide.

Decks are stored on disk in `DECKCRAFT_V3_DIR` (default: the OS temp dir `deckcraft-v3/`). v3 needs a Node server with Playwright's Chromium (`npx playwright install chromium`) — it will not run on serverless hosting.

### .env keys for v3

At least one LLM provider; more providers = more free capacity and failover.

```
GROQ_API_KEY=...              # recommended: gpt-oss-120b (design) + llama-4-scout (vision)
GOOGLE_AI_API_KEY=...         # Gemini flash / flash-lite (aliases gemini-flash-latest, gemini-flash-lite-latest)
OPENROUTER_API_KEY=...        # optional, free models
CLOUDFLARE_API_TOKEN=...      # Workers AI: Flux images + fallback LLMs
CLOUDFLARE_ACCOUNT_ID=...
SEMANTIC_SCHOLAR_API_KEY=...  # optional, better paper search
OPENALEX_API_KEY=...          # recommended, free at openalex.org/settings/api (anonymous budget is tiny now)
OPENALEX_MAILTO=you@example.com

# optional tuning
# CUSTOM_LLM_BASE_URL=...  CUSTOM_LLM_API_KEY=...   any OpenAI-compatible provider, use provider "custom" in routes
# ENGINE_V3_ROUTES='{"design":[{"provider":"groq","model":"openai/gpt-oss-120b"}]}'   override routes per role ("*" = all roles)
# GROQ_BASE_URL / GOOGLE_AI_BASE_URL / OPENROUTER_BASE_URL / CLOUDFLARE_BASE_URL     override provider base URLs
# V3_DESIGN_REASONING=medium   V3_MAX_REVISIONS=2   V3_VISION_QA=off   PPTX_FONT_MODE=web
# DECKCRAFT_V3_DIR=./.decks
```

Routes per role live in `src/config/models.json → engineV3.roles` (brief, research, outline, art, design, vision). Each role tries its routes in order; 429/5xx/timeouts fail over to the next route, and each provider has its own requests-per-minute + concurrency limiter so parallel designers don't trip free-tier limits.

**Free-tier reality (Oct 2026):** Gemini's free tier is small for Flash models (tens of requests/day on many keys) and `gemini-2.5-*` is closed to new keys — the v3 routes use `gemini-flash-latest` / `gemini-flash-lite-latest`. Groq's free tier gives the most requests for `openai/gpt-oss-120b` but limits tokens/minute, so the designer pool spreads calls over providers. One 10-slide deck ≈ 25–35 LLM calls.

**Fonts in PPTX:** PowerPoint can't receive web fonts from pptxgenjs, so each design font pair maps to an Office-safe twin (e.g. Poppins → Century Gothic, Inter → Calibri, Merriweather → Georgia, Noto Sans Devanagari → Nirmala UI). Set `PPTX_FONT_MODE=web` to write the web font names instead (looks perfect in Google Slides or where the fonts are installed).

> **Design model matters most.** In testing, a Kimi-class model (Groq `moonshotai/kimi-k2-instruct-0905`, free tier) as the `design` role produced far better slides than `gpt-oss-120b`. Keep your strongest free model first in `engineV3.roles.design` in `src/config/models.json`. Set `OPENALEX_API_KEY` (free) to avoid scholarly-search rate limits.
