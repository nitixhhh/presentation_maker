# Images, photos and logos

## Photo vs AI image vs none

| Situation | Use |
|---|---|
| A real thing, place, person, event, specimen, artwork | Real photo (search_photos: Wikimedia Commons, NASA, Openverse, Wikipedia lead image) |
| Something that cannot be photographed (a concept, the inside of a black hole, a future scene) | AI-generated illustration, clearly an illustration |
| A process, structure or comparison | No photo — a diagram explains better |
| Numbers | No photo — big number or chart |
| Abstract idea with no good picture | No photo — strong typography, icon cards or a quote |

- Real first: for factual/academic decks a real photo is more credible than an AI image.
- Never use an AI image to depict a real, specific person, place, event or scientific result as
  if it were a photo (e.g. "the first image of a black hole" must be the real EHT image).
- One main image per slide. A mosaic of 3–4 photos is fine only when the comparison is the point.
- If no suitable photo is found after 2–3 searches, design without one. An empty frame or an
  irrelevant stock photo is worse than none.

## Searching photos
- Search the concrete subject: "Cygnus X-1 artist", "tardigrade microscope", "ISRO Chandrayaan-3 launch".
- Prefer: high resolution (≥ 1280 px on the long side for full-bleed, ≥ 800 px for panels),
  no watermark, no text baked in, subject clearly visible, licence that allows reuse
  (public domain, CC0, CC BY, CC BY-SA). Avoid NC/ND licences for anything commercial.
- Check orientation against your layout: landscape for full-bleed/bands, portrait for side strips.

## Cropping and placement
- Always `object-fit:cover` (never stretch); set `object-position` so the subject stays in frame
  (e.g. `70% 40%` when the subject is right of centre).
- Full-bleed (edge to edge) looks more premium than a small framed photo in a box.
- Let photos bleed off one edge in split layouts (40–60 % of the width).
- Faces and eyes look INTO the slide (toward the text), not off the edge.
- Crop tighter for impact; remove empty sky/floor unless it gives the text a calm area.
- Rounded corners, circles, arches and diagonal clip-paths are fine — one shape style per deck.

## Text on photos (scrims)
Text on a photo must stay readable: aim for ≥ 4.5:1 contrast for body text, ≥ 3:1 for very large text.
Techniques, in order of reliability:
1. Put text on the calm side and add a gradient scrim from var(--bg) (or black) to transparent:
   `linear-gradient(90deg, var(--bg) 0%, color-mix(in srgb,var(--bg) 85%,transparent) 45%, transparent 80%)`.
2. Bottom scrim for captions: `linear-gradient(0deg, rgba(0,0,0,.78), transparent)` with white text.
3. Solid or semi-solid card behind the text (surface colour, 90–100 % opacity).
4. Darken the whole photo: `filter:brightness(.55)` or an overlay at 40–60 % — for title/section slides.
Never put body text over a busy area without one of these. White text with a subtle text-shadow
alone is not enough.

## Attribution
- Do not print credits on content slides. The engine lists every image credit on the References
  slide (title — author — licence — source), following the Title/Author/Source/Licence pattern.
- If a slide is a pure photo showcase, a 14 px credit line in a corner is acceptable.
- AI images need no credit but must not pretend to be real photographs.

## Logo rules (university / company / club logo)
1. Title slide: logo allowed, small and clean — height 56–96 px, in a corner or above the title.
2. Closing slide: same as the title slide (optional).
3. Other slides: either no logo, or the engine's small corner logo (height ≤ 40 px) in the same
   corner on every slide. You do not place it yourself on content slides.
4. NEVER: logo as background, watermark, hero image, full-bleed, inside a clip-path shape,
   stretched, recoloured, cropped, rotated, or as the "image" of a slide that had no photo.
5. A logo is not content. If the only asset you have is a logo, the slide has NO photo —
   use a diagram, icons, a big number or typography.
6. Keep the logo on a plain area with enough contrast; a transparent PNG on a busy photo needs a
   white or surface chip behind it.

## Quick CSS treatments

```css
/* duotone */
.slide .ph{filter:grayscale(1) contrast(1.1);mix-blend-mode:multiply}
.slide .tint{background:var(--primary)}
/* arch mask */
.slide .ph{border-radius:280px 280px 24px 24px}
/* diagonal panel */
.slide .ph{clip-path:polygon(18% 0,100% 0,100% 100%,0 100%)}
```

## Don't
- No placeholder boxes, "[Image]" text, broken images or images from raw web URLs.
- No low-res, pixelated, watermarked or meme images in academic decks.
- No stock photo clichés (handshakes, people pointing at screens) unless they truly fit.
- Don't use the same photo on two slides (except title and closing echo).
