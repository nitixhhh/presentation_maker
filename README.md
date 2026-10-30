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
- **Free FLUX.1 AI Image Generator (`src/engine/assets/imageGenerator.ts`)**:
  - Powered by Pollinations.ai FLUX.1 engine (100% free, unlimited, no API key required).
  - Eliminates repetitive stock laptop photo fallbacks by generating bespoke cinematic 16:9 imagery.
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
