# Workflow: designing one slide

Follow these steps in order. Each step names the tool or file to use.

## 1. Read the brief (no tools)

Answer these four questions in one line each before touching HTML:
- Role: title / agenda / section / content / data / comparison / process / quote / references / closing?
- Message: what single sentence should the audience remember? (the key message)
- Evidence: which points, numbers and sources were given? Only these may appear.
- Neighbours: what layout do the previous and next slides use? Yours must look different.

If the brief has more than 4 points, merge or cut — do not cram (see principles.md).

## 2. Pick a layout (read_skill)

Match the content's SHAPE, not the topic:

| Content shape | Layout file |
|---|---|
| Opening slide | layouts/title.md |
| New part of the talk | layouts/section-divider.md |
| List of sections | layouts/agenda.md |
| 3–4 parallel ideas | layouts/bullets-with-icons.md |
| A vs B | layouts/two-column-comparison.md |
| Good vs bad of one thing | layouts/pros-cons.md |
| Events in time order | layouts/timeline.md |
| Ordered steps with an end | layouts/process-steps.md |
| Steps that repeat | layouts/cycle.md |
| One centre, several parts | layouts/hub-and-spoke.md |
| 1–3 striking numbers | layouts/stats-big-numbers.md |
| A series of numbers | layouts/chart.md (+ charts-data.md) |
| A memorable sentence by a person | layouts/quote.md |
| A strong photo carries the point | layouts/image-focus.md |
| People | layouts/team-people.md |
| Many attributes × several items | layouts/table.md |
| Wrap-up / thank you | layouts/conclusion.md |
| Sources | layouts/references.md |

Read only the one or two layout files you need. The skeletons are starting points: change
positions, proportions and treatment so the slide fits its content and the art direction.

## 3. Pick the visual (tools)

One main visual per slide, taking 40–60 % of the canvas. Decide in this order:
1. Is there a process, cycle, structure or comparison? → diagram (make_diagram; read diagrams.md if unsure).
2. Are there numbers that are the point? → big number or chart (charts-data.md).
3. Is there a photo asset, or would a real photo help? → photo (search_photos; images.md).
4. Several parallel ideas? → icons with labels (search_icons; icons.md).
5. None of these? → strong typography: one big statement, a big numeral, a coloured panel.

Never combine more than two visual types on one slide (e.g. photo + icons is fine; photo +
chart + icons is clutter).

## 4. Write the HTML

- Start from the layout skeleton. Keep the containers: each text group in its own positioned
  box with an explicit width, text flowing inside with flex/grid and gap.
- Title at the same place as the rest of the deck (consistency); use the deck motif.
- Tighten wording: titles ≤ 10 words, points ≤ 15 words, no full stops on fragments.
- Sizes: title 44–64 px, key message 28–36 px, body 24–30 px, labels ≥ 18 px.
- Colours only through var(--…). One accent highlight per slide.
- Add citation markers `<sup>[2]</sup>` right after the sentence they support.
- Write speaker notes: 3–5 spoken sentences that explain, not repeat, the slide.

## 5. Check (check_slide)

Call check_slide with your HTML. Read every issue.
- High severity (clipped, overlap, out-of-canvas, covered, low-contrast, invented-number,
  broken-image, unknown icon/asset, placeholder): must fix.
- Medium (sparse, small-body, too-much-text): fix unless there is a clear reason.
- Then run qa-checklist.md in your head against the screenshot description.

## 6. Fix

Fix the cause, in this order of preference:
1. Cut words (the best fix for overflow).
2. Give the box more room (wider, or move the visual).
3. Change the layout (e.g. 4 cards → 2×2 grid).
4. Only then reduce font size — never below the minimums.

Re-run check_slide after each fix. Maximum 3 fix rounds; if still failing, switch to a simpler
layout with fewer elements and check again.

## 7. Submit (submit_slide)

Submit only when check_slide shows no high issue. The user sees the slide immediately.

## Example (slide 3, "How GPUs speed up AI", 3 points, no photo)

1. Brief: content slide; message "GPUs run thousands of small maths jobs at once";
   neighbours are a photo title and a timeline.
2. Layout: 3 parallel ideas → layouts/bullets-with-icons.md.
3. Visual: icons — search_icons("gpu") → `lucide:cpu`, `tabler:device-desktop-analytics`;
   search_icons("parallel") → `lucide:layers`; search_icons("speed") → `lucide:gauge`.
4. HTML: title top-left, key message line, three cards each with a 56 px icon in a tinted
   circle, a 26 px label and a 20 px description.
5. check_slide → "text-clipped: card 3 description wider than its box". Fix: cut 6 words.
6. check_slide → clean. submit_slide.

## Don't

- Don't start writing HTML before you know the message.
- Don't read every skill file "just in case" — it wastes the token budget.
- Don't submit without check_slide.
- Don't invent facts, numbers, names, dates or sources to fill space.
- Don't copy the previous slide's layout.
