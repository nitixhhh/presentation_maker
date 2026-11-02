# Engine v5: designer templates with slot-filling AI

How v5 makes a deck:
1. The **brief and research** stages are shared with v3. v4's `deepenResearch` adds more scholarly sources.
2. The **planner** (`planner.ts`) makes ONE JSON call. For every slide the model picks a designed template from `templates.ts` (30 of them) and fills that template's length-limited slots. It also suggests a theme.
3. The engine then checks the plan in code:
   - slide 1 is a title slide; references sit at N-1 and closing at N
   - slots are clamped to their length limits
   - fact ids are stripped from slide text
   - neighbouring slides never share a template, and each card grid appears once per deck
   - icons are resolved to real library ids and kept distinct on each slide
   - timelines are put in date order
   - any slide the model left out or left broken is rewritten with one small AI call
4. **Themes** (`themes.ts`): 8 hand-made palettes, each paired with a font pair (including Hindi fonts) and a decor style. The theme is chosen from the style hint, then the planner's suggestion, then the topic's keywords.
5. **Render** (`render.ts`, `templates.ts`, `styles.ts`) is deterministic HTML/CSS. A template that needs a photo it doesn't have falls back to a designed no-photo layout.
6. **Auto-fit** (`fit.ts`) runs in the real browser:
   - it shrinks the title to its line budget
   - it binary-searches the largest body type scale with no overflow; the body text never goes below 20px
   - if a slide still overflows, the engine trims the last item or shortens the longest text
   - the resulting scales are written into the stored HTML, so the preview, PDF and PPTX all match
7. **Photos**: the planner gives a query plus an alternative query. Photos are vetted by the vision model, and the title photo is reused on the agenda sidebar and the closing slide.
8. **Vision QA** checks only the risky slides: those with DOM issues, a photo, a diagram, or slide 1. It never holds a render slot, and the engine waits at most `V5_VISION_GRACE_S` (90 s) for it.
9. **Edits** (`edit.ts`): a student edit re-fills the slide's slots, optionally switching to another template, and re-renders it, so the slide keeps its designed look.

Knobs:
- `V5_VISION_QA`: smart (default), always or off
- `V5_VISION_GRACE_S`: default 90

Dev tools:
- `tsx scripts/v5-fixture.ts <out> <theme> <lang>` renders every template from fixture content with no AI. Use `ONLY=` to pick templates and `ALT_<id>=<fixture key>` to swap in alternative content.
- `tsx scripts/v4-job.ts '<request json with engine:"v5">' <out>` runs the full job path locally.
- `tsx scripts/v5-edit-test.ts <dataDir> <deckId> <n> "<instruction>"` tries one edit.
