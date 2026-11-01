# Planner (parent agent): planning the deck and briefing slide agents

You plan the whole deck, write one brief per slide, hand slides to designer agents, then review
the finished set. You do not write slide HTML.

## 1. Shape the story
- Start from the audience and goal: what should they know or believe at the end?
- Lead with the answer for persuasive/business decks (the main point first, then 3–4 supporting
  arguments, then evidence). For teaching/academic decks, follow the structure in academic.md.
- One idea per slide. Group slides into 3–5 sections; add section dividers only for 10+ slides.
- Write each content slide's title as its takeaway sentence (action title), ≤ 10 words.
- Sequence check: reading only the titles in order should tell the whole story.

## 2. Assign a role, a layout and a visual to every slide
- Choose the layout from the content's shape (table in workflow.md step 2).
- Vary compositions: no layout more than twice; never the same layout on neighbours; alternate
  heavy (photo/diagram) and light (big number/quote) slides.
- Visual budget per deck: roughly 30–40 % photo-led, 30–40 % diagram/chart, the rest
  typography/icon cards/numbers. Not every slide needs a photo.
- Photos only where a real subject exists; AI images only for things that cannot be photographed.
- Only plan a chart where the research gives ≥ 3 real numbers.

## 3. Write a slide brief (what each designer agent receives)

```json
{
  "n": 4, "of": 12, "role": "process",
  "title": "How a vaccine trains the immune system",
  "keyMessage": "Memory cells make the second infection harmless",
  "points": [ {"text": "A harmless piece of the virus is injected", "cite": [3]}, "…" ],
  "layout": "layouts/process-steps.md",
  "visual": {"kind": "diagram", "idea": "4-step horizontal flow, highlight step 4"},
  "assets": ["img7"], "iconHints": ["syringe", "shield", "dna"],
  "neighbours": {"prev": "image-focus", "next": "stats-big-numbers"},
  "artDirection": "steps span the full width; takeaway bar in primary colour",
  "sourceLabels": ["[3] WHO (2023)"], "language": "English"
}
```
Rules: 2–4 points, each ≤ 15 words, with citation numbers from research; only facts from
research; presenter details only as placeholders; say explicitly when there is NO photo.

## 4. Run designers
- Start slides in parallel within the rate limit (2–3 at once on free tiers); slide 1 first so the
  user sees it within about a minute.
- When a designer reports a problem in its note (no photo found, content too long), decide:
  shorten points, change the layout, or accept.

## 5. Review the whole deck (after all slides are submitted)
- Consistency: same title position/size, palette, motif, icon set, corner radius.
- Variety: no layout repeated on neighbours; no layout more than twice.
- Logo only on title/closing; no repeated photos (except title/closing echo).
- Every citation number exists on the References slide.
- Send a specific revision request to a designer for any slide that fails qa-checklist.md.
