# Common mistakes — how to detect and fix them

Each row: the failure, how you (or check_slide) notice it, and the fix. These come from real
DeckCraft decks (e.g. the 2026-11-01 "Simulation" deck: logo as hero on 3 slides, text spilling
past panels, a references slide broken by a long URL).

## Layout and text

| Mistake | Detect | Fix |
|---|---|---|
| Text overflows its panel/card/slide | check_slide: text-clipped, out-of-canvas; text edge past the card's edge in the screenshot | Cut words first; widen the box; move to a grid with more room; only then reduce size (never below minimums) |
| Separately absolute-positioned text lines collide | text-overlap | Put the group in ONE positioned container and flow lines with flex column + gap |
| Long URL / DOI / chemical name runs off the slide | out-of-canvas on references; one very wide line | `overflow-wrap:anywhere; word-break:break-word` on the text element |
| Shape drawn on top of text | text-covered | Put decoration behind (earlier in markup or lower z-index); never position shapes over text |
| Tiny text | tiny-text, small-body, small-label | Body ≥ 24 px, labels ≥ 18 px; cut content to fit. Source lines: ≤ 6 words at 16–18 px, or ≥ 20 px |
| Wall of text | too-much-text (> 120 words), > 4 lines in a block | Keep ≤ 55 body words; move detail to speaker notes |
| Half-empty slide / tiny centred content | sparse; large blank areas in the screenshot | Enlarge the main visual to 40–60 % of the canvas; rebalance. (sparse only counts text, images and SVG — a full card grid may still be flagged; trust the screenshot) |
| Text hugging the edge | text closer than 56 px to an edge | Keep the 56–80 px safe margin |
| Misaligned elements | edges that almost line up | Snap to the 80 px margins and shared column edges |
| Same layout on every slide | neighbours share the composition | Pick a different layout file; vary photo/diagram/number/typography slides |
| Plain bullet list for structured content | list of steps, causes, or A vs B | Convert to process, icon cards, comparison |

## Colour and readability

| Mistake | Detect | Fix |
|---|---|---|
| Low contrast text | low-contrast; grey on white; colour on colour | Use var(--ink) on var(--bg)/--surface; ≥ 4.5:1 (aim 7:1) |
| Text on a busy photo | busy-background; text over detailed photo area | Gradient scrim, solid card, or move text to the calm side |
| Too many colours | 3+ accent colours on a slide | Primary + one accent; others neutral |
| Meaning by colour only | red/green with no words | Add labels, ✓/✗ icons, headings |

## Images, logos, icons

| Mistake | Detect | Fix |
|---|---|---|
| Logo as background / hero / big image | logo asset larger than ~100 px tall, full-bleed, or behind text | Remove; logo only small on title/closing slide (see images.md) |
| Logo on every slide placed by you | logo `<img>` on a content slide | Delete it — the engine adds a consistent small corner logo if configured |
| Broken / unknown image | broken-image, unknown-asset | Use only asset ids from the brief or search_photos |
| Stretched / pixelated photo | distorted subject; small source used full-bleed | object-fit:cover; pick a higher-res photo or a smaller panel |
| Irrelevant stock photo | photo does not show the slide's subject | Search again with the concrete subject, or design without a photo |
| AI image passed off as real | "photo" of a real event/person that was generated | Use a real photo or label it an illustration; prefer a diagram |
| Decorative icon spam | icons without labels, icons in corners, mixed styles | One set, one size, always with a label; remove decoration |
| Unknown icon name | check_slide reports unknown icon | Use names returned by search_icons |
| Emoji as icons | emoji in text used as bullets | Replace with library icons or numbers |

## Content and truth

| Mistake | Detect | Fix |
|---|---|---|
| Invented numbers / dates | invented-number | Remove; only numbers present in the brief |
| Invented contact details | placeholder-contact (emails, URLs, phones) | Remove; nobody gave them |
| Invented names / "Your Name" / fake presenter | names not in the brief | Use the {{P#}} placeholders or nothing |
| Invented quote or citation | quote/source not in research | Remove or use the given source labels only |
| Placeholder text | placeholder ("[Image]", lorem ipsum, TODO) | Write real content or remove the element |
| Chart from non-numeric points | chart with made-up values | Use icon cards or a diagram instead |
| Empty card or panel | a container with no text/visual | Fill it with content or delete it |

## Diagrams

| Mistake | Detect | Fix |
|---|---|---|
| Arrows pointing at nothing / crossing text | line-over-text; arrow ends in empty space | Connect box edge to box edge; use the engine diagram component |
| Labels overlapping in SVG | label-overlap, label-clipped | Fewer items, bigger box, shorter labels, or the component |
| Boxes with no relationships | "diagram" of unconnected boxes | Add the arrows/structure, or make it icon cards |
| Too many nodes | > 6 in flow/cycle/hub | Group into phases or split slides |

## Process mistakes
- Submitting without check_slide.
- Fixing overflow by shrinking all text to 14 px.
- Reading every skill file for every slide (token waste) — read INDEX, workflow, one layout, one topic.
- Looping more than 3 fix rounds on the same layout instead of simplifying.


## Fixed heights
- Never give a grid/flex container that holds text a fixed `height` — use `min-height` (or top + bottom) so cards grow instead of clipping text. Overflowing cards are the most common reason a slide is rejected.
- Never shrink body text below 20px to make it fit: cut words, use fewer columns, or move the badge beside the text.
