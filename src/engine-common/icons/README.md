# DeckCraft icon library

8,272 real SVG icons with search. The Standard and Advanced planners pick icons by name; every render swaps `<i data-icon="lucide:cpu">` for the inline SVG (`../iconRender.ts`). No external dependencies.

| Set | Icons | Licence | Version | Style |
|---|---|---|---|---|
| Lucide | 2,015 (+261 old names kept as aliases) | ISC | 1.66.0 | outline, 24 grid, 2px round stroke |
| Tabler outline | 5,203 (incl. 378 `brand-*` logos, demoted in search) | MIT | 3.50.0 | outline, 24 grid, 2px round stroke |
| Tabler filled | 1,054 | MIT | 3.50.0 | solid fill |

Lucide and Tabler outline use the same grid, stroke and caps, so they mix cleanly on one slide.
Phosphor (MIT) was left out: it is drawn on a 256 grid with filled outlines, so it would look different next to the other two, and the first two sets already cover every concept tested.
Licence texts are in `licenses/`. ISC/MIT only require keeping the notice with the source. Nothing visible is needed on the slides.

## Files

- `icons.bundle.json` (3.2 MB, 650 KB gzipped) holds every icon as `[set, name, categories, tags, aliases, svgBody]`, plus 232 synonym concepts (English and Hinglish). Bodies are normalised: viewBox 24, no width/height, no classes, only path/circle/rect/line/polyline/polygon/ellipse.
- `icons.ts` exports `searchIcons`, `getIcon`, `findIcon`, `expandIconPlaceholders`, `sanitizeSvg`.
- `icons.test.ts` runs with `npm test`.

The server runs `next start` from the repo root, so the default path `process.cwd()/src/engine-common/icons/icons.bundle.json` resolves. Set `ICONS_BUNDLE_PATH` to keep it elsewhere.

## Speed and memory

First call loads the bundle in about 290 ms (about 34 MB heap); each search after that takes about 27 ms.
