# DeckCraft icon library (engine-v4)

8,272 real SVG icons with search, for the designer agent. No external dependencies.

| Set | Icons | Licence | Version | Style |
|---|---|---|---|---|
| Lucide | 2,015 (+261 old names kept as aliases) | ISC | 1.66.0 | outline, 24 grid, 2px round stroke |
| Tabler outline | 5,203 (incl. 378 `brand-*` logos, demoted in search) | MIT | 3.50.0 | outline, 24 grid, 2px round stroke |
| Tabler filled | 1,054 | MIT | 3.50.0 | solid fill |

Lucide and Tabler outline use the same grid, stroke and caps, so they mix cleanly on one slide.
Phosphor (MIT) was left out: it is drawn on a 256 grid with filled outlines, so it would look different next to the other two, and the first two sets already cover every concept tested.
Licence texts are in `licenses/`. ISC/MIT only require keeping the notice with the source. Nothing visible is needed on the slides.

## Files

- `icons.bundle.json` (3.2 MB, 650 KB gzipped) holds every icon as `[set, name, categories, tags, aliases, svgBody]`, plus 232 synonym concepts. The bodies are already normalised: viewBox 24, no width or height, no classes, Tabler's invisible bounding-box path removed, and only path/circle/rect/line/polyline/polygon/ellipse elements (checked at build time).
- `icons.ts` exports `searchIcons`, `getIcon`, `findIcon`, `expandIconPlaceholders`, `sanitizeSvg`, `iconDataUri`, `ICON_TOOL_DEFS` and `handleIconTool`.
- `icons.test.ts` has 13 node:test tests; run them with `npx tsx --test icons.test.ts`.
- `search-icons.ts` is a CLI: `npx tsx search-icons.ts gpu "chart up" paisa`, plus `--svg lucide:cpu --size 64 --color "#2563eb"` and `--info`.
- `build/synonyms.json` holds the hand-written concepts, in English and Hinglish. Edit it, then rerun `build/build_bundle.py`.
- `build/build_bundle.py` rebuilds the bundle from the npm packages and the Lucide repo's metadata (the steps are in its header).
- `build/make-sheet.ts` renders `sheet.png`; `build/bench.ts` measures load time, memory and per-query speed.
- `search_quality.md` lists the top-3 results for the test queries.

## Speed and memory

Measured on the box (Node 22): the first call loads the bundle in about 290 ms and uses about 34 MB of heap. Each search after that takes about 27 ms, which is small next to an LLM tool call.

## How the engine should use it

1. Copy `icons.ts`, `icons.bundle.json`, `icons.test.ts` and `search-icons.ts` to `src/engine-v4/icons/`, and add `src/engine-v4/icons/icons.test.ts` to the `npm test` list.
   The Dockerfile copies the whole repo and runs `next start` from `/app`, so the default path `process.cwd()/src/engine-v4/icons/icons.bundle.json` resolves. To keep it somewhere else, set `ICONS_BUNDLE_PATH`.
2. Give the designer agent the two tools in `ICON_TOOL_DEFS` (OpenAI function format), and route tool calls through `handleIconTool(name, args)`:
   - `search_icons({query:"gpu", limit:6})` returns `{results:[{id:"lucide:gpu", tags:[...]}, ...]}`.
   - `get_icon({name:"lucide:gpu", size:56, color:"#2563eb"})` returns `{svg:"<svg ...>"}`. An unknown name returns `{error, suggestions}`.
3. **Better, and cheaper in tokens:** the model shouldn't paste SVG into its HTML. It writes a placeholder:
   ```html
   <i data-icon="lucide:gpu" data-size="56" data-color="#2563eb"></i>
   ```
   Before rendering or checking, the engine runs `expandIconPlaceholders(html)`. That turns every placeholder into inline SVG and returns `{html, used, missing}`. If the model writes a concept instead of an id (`data-icon="paisa"`), it gets the best search hit. Anything still unknown is removed and listed in `missing`, so the QA step can flag it.
   With this, the model only needs `search_icons`. `get_icon` is optional, for when it wants to see the drawing.
4. The rendered SVG has `class="dc-icon dc-icon-<name>"`, `aria-hidden` (or `role=img` with a title), and `stroke`/`fill` set to the colour given. With no colour it uses `currentColor`, so it takes the CSS `color` of its container. Use `style:"filled"` in search for solid icons such as stat badges or rating stars.
5. All options are sanitised. Colour, size and style values that don't match a strict pattern fall back to defaults, so a model can't inject attributes. `sanitizeSvg()` is there for any SVG the model draws by hand (diagrams): it strips scripts, event handlers, foreignObject and external URLs.

## Search scoring (short)

The query is split into tokens; ₹, $, € and % become words. Each token is scored against the icon's name parts (an exact match on the first word scores highest), its old names, its tags and its category, with prefix and typo tolerance (one edit for words of 5–7 letters, two for 8+).
Concepts in `synonyms.json` add expansion terms and a ranked "prefer" list. For example, `paisa` → indian-rupee and `graphics card` → gpu. A multi-word phrase beats its single words.
Variants such as `-off`, `-x`, `-plus` and numbered versions are pushed down unless the query asks for them. `brand-*` logos only show up when the query says "logo" or "brand". The same name in two sets shows once, with the Lucide drawing winning ties. Results scoring under 20 % of the best one are dropped.
