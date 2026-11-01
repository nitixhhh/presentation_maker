# DeckCraft skill library — index (read this first)

Read only what the current slide needs: usually workflow.md + one layout + one or two topic files.
Each file is short; open it with read_skill("path").

## Core
- engine.md — how the engine works, the 1280×720 canvas, allowed HTML/CSS, the tools and the output format. Read once per job.
- workflow.md — step-by-step for designing ONE slide (brief → layout → visual → HTML → check → fix → submit). Read for every slide.
- principles.md — hierarchy, one idea per slide, whitespace, grid, consistency, text limits. Read when unsure how much to put on a slide.
- planner.md — for the parent agent: story, slide roles, layout variety, the per-slide brief format, final deck review.

## Topics
- icons.md — when to use icons and when not, sizes/colour/one style per deck, label pairing, searching by concept (gpu, planet, cpu…). Read before search_icons.
- diagrams.md — choosing flow / cycle / hub / timeline / layers / tree / matrix / sequence, make_diagram, Mermaid vs templates, arrows and labels. Read for any diagram slide.
- images.md — photo vs AI image vs none, cropping, scrims for text on photos, credits, LOGO RULES. Read whenever a slide has an image or a logo.
- typography-colour.md — the engine's font pairs, sizes for 16:9, WCAG contrast, palette roles, light/dark. Read when styling text or colour.
- charts-data.md — choosing chart types, labelling, highlight the insight, no 3D, only real numbers. Read for data slides.
- academic.md — student/university conventions: title slide fields (only what's given), deck structures, APA/IEEE references, Indian norms. Read for title, references and academic decks.
- mistakes.md — failure → how to detect → how to fix (overflow, long URLs, contrast, logo misuse, empty half-slides, repeated layouts, icon spam, invented facts). Read when check_slide reports issues.
- qa-checklist.md — the final per-slide check before submit_slide. Read for every slide before submitting.

## Layouts (each has an HTML skeleton that fits the canvas)
- layouts/title.md — opening slide: hero photo with scrim, or typographic; presenter placeholders; small logo.
- layouts/section-divider.md — start of a new part in long decks: giant number + section title.
- layouts/agenda.md — 3–6 sections as numbered cards or a path, not bullets.
- layouts/bullets-with-icons.md — 3–4 parallel ideas as icon cards (the upgrade of a bullet list).
- layouts/two-column-comparison.md — A vs B on matching criteria.
- layouts/pros-cons.md — advantages and limitations of one thing, with a verdict.
- layouts/timeline.md — 3–6 dated events in order.
- layouts/process-steps.md — 3–5 ordered steps with arrows and a takeaway.
- layouts/cycle.md — repeating stages (engine cycle diagram + explanation).
- layouts/hub-and-spoke.md — one centre with 3–6 parts.
- layouts/stats-big-numbers.md — 1–3 striking numbers with labels and sources.
- layouts/chart.md — a real data series as a chart + insight callout.
- layouts/quote.md — one real quote with attribution.
- layouts/image-focus.md — the photo is the slide: full-bleed, scrim, caption.
- layouts/team-people.md — team members or key people (only given names).
- layouts/table.md — items × attributes with short values.
- layouts/conclusion.md — key takeaways and/or thank-you slide.
- layouts/references.md — numbered sources, wrapped URLs, image credits.

All sample text, names and numbers in the skeletons are illustrations — never copy them onto a slide.
