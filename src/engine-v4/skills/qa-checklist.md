# Final QA checklist (run before submit_slide)

Run check_slide first. Then answer every line from the result and the screenshot. Any "no" on
a MUST line means fix and check again.

## MUST (blocking)
1. check_slide shows no high-severity issue.
2. Nothing is cut off, overlapping or outside 1280×720; text stays inside its panel/card.
3. Text is ≥ 56 px from the slide edges (full-bleed images/shapes excepted).
4. Every text is readable: body ≥ 24 px (cards ≥ 20 px), labels ≥ 18 px, contrast ≥ 4.5:1;
   text on photos has a scrim or card.
5. All facts, numbers, dates, names, quotes and sources come from the brief. No invented
   emails, URLs, phone numbers or people. Student details only as {{P#}} placeholders.
6. Every image is a valid asset id; no placeholder boxes or "[Image]" text; no stretched photos.
7. The logo (if any) is small and only on the title/closing slide — never background or hero.
8. Every icon has a text label, comes from one style set, and its name came from search_icons.
9. Every arrow connects two things and crosses no text.
10. Every CSS selector starts with `.slide`; colours use var(--…); no scripts, animations or external URLs.
11. Speaker notes exist: 3–5 spoken sentences, in the deck's language, explaining the content.

## SHOULD (quality)
12. Glance test: the point of the slide is clear in ~3 seconds; the title or key message states it.
13. Clear hierarchy: one focal element (largest/accent), then supporting points, then small details.
14. One main visual taking roughly 40–60 % of the canvas; no big dead areas.
15. ≤ 4 points, ≤ 55 body words, lines 35–60 characters, ≤ 4 lines per block.
16. Elements align to the margins/grid; equal items have equal sizes and spacing.
17. The accent colour marks only the most important thing.
18. The layout differs from the previous and next slides; title position matches the deck.
19. The slide follows the art direction and the deck motif.
20. Citation markers `<sup>[n]</sup>` follow the sentences they support; references slide URLs wrap.

## Role-specific checks
- Title: title dominant; only given presenter fields; logo small; striking visual.
- Agenda: 3–6 items as a designed sequence, not plain bullets.
- Data/chart: insight stated in the title; only given numbers; highlight + source line; no 3D.
- Diagram: right diagram type for the relationship; ≤ 6 nodes; labels ≥ 18 px.
- Quote: real quote from research with attribution.
- References: exact list, in order, wrapped, two columns if > 5, no decoration overload.
- Closing: echoes the title slide; no new facts; no invented contact details.

## Report format (what you note when submitting)
If something could not be fixed (e.g. no fitting photo found), say so in one line in your
submission note so the parent agent can decide; never hide a problem by deleting content the brief required.
