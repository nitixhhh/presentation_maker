# Diagrams

A diagram shows relationships that words describe slowly: order, cause, structure, comparison.
Pick the diagram from the SHAPE of the relationship.

## Choosing the diagram

| Relationship | Diagram | make_diagram kind | Items |
|---|---|---|---|
| Ordered steps with an end | Flow / process | flow | 3–6 |
| Steps that repeat | Cycle | cycle | 3–6 |
| One centre, several parts or factors | Hub and spoke | hub | 1 + 3–6 |
| Events in time | Timeline | timeline | 3–6 |
| Stack of levels (architecture, layers of Earth) | Layers | layers | 3–5 |
| Hierarchy (classification, org chart, family) | Tree | tree | ≤ 10 nodes, ≤ 3 levels |
| Two options side by side | Compare | compare | 2 × 2–4 |
| Two criteria → four groups | 2×2 matrix | matrix | 4 quadrants |
| Who talks to whom over time (protocols, APIs) | Sequence | sequence / mermaid | ≤ 5 actors, ≤ 8 messages |
| Branching decisions | Flowchart with yes/no | mermaid (flowchart) | ≤ 10 nodes |
| Overlap of sets | Venn (2–3 circles) | custom SVG | 2–3 |

If the relationship is just "a list of things", it is not a diagram — use icon cards.

## make_diagram

```json
{ "kind": "flow", "items": [ {"title":"Light source","desc":"lamp emits light"}, {"title":"Sample","desc":"absorbs some colours"} ],
  "box": {"left":620,"top":200,"width":580,"height":380}, "direction": "auto" }
```

It returns markup to paste into the slide (the engine component, or a static themed SVG for
tree/matrix/sequence/mermaid). For hub, the first item is the centre. For compare, the first
half is the left column.

## Mermaid vs engine templates
- Use the engine kinds (flow, cycle, hub, timeline, layers, compare, matrix, tree) for most slides:
  they use the deck palette and fonts and their labels stay editable in PPTX.
- Use Mermaid only for what templates cannot draw well: branching flowcharts with decisions,
  sequence diagrams, state diagrams. The engine renders Mermaid to a static SVG with the deck
  theme (no JavaScript on the slide). Its text becomes part of the background image in PPTX.
- Mermaid code inside spec.code; keep it small:

```text
flowchart LR
  A[Input image] --> B{Face found?}
  B -- Yes --> C[Crop and align]
  B -- No --> D[Skip frame]
```

## Arrows and labels
- Every arrow connects two things; arrows start and end at box edges, never inside text.
- One direction of reading: left→right or top→bottom (clockwise for cycles).
- Arrowheads only when direction matters; plain lines for "is related to" (hub spokes).
- Label every node: 1–4 word title (≥ 20 px) + optional ≤ 8-word description (≥ 18 px).
- Label arrows only when the relation is not obvious ("produces", "sends request"), ≤ 3 words.
- No line passes through a label; no label touches another.

## Readability limits
- ≤ 6 nodes in a flow/cycle/hub; ≤ 10 in a tree or flowchart; split anything larger.
- Give the diagram a generous box: at least 480×300, usually 40–60 % of the slide.
- Diagram text ≥ 18 px after scaling. If labels become small, reduce items or enlarge the box.
- One accent: highlight the step/node the slide is about; everything else in the base style.

## Hand-drawn SVG (only for small illustrations)
Allowed for simple shapes the libraries lack (a cuvette, a wave, a molecule outline, a Venn).
Rules: viewBox set, `<text>` ≥ 18 px and fully inside the svg, no shape on top of text, strokes
2–4 px in var(--primary)/var(--ink). Never hand-draw charts — use bars/chart kinds.

## Don't
- Don't draw "box + box + box" with no arrows or relationships — that's a list pretending.
- Don't use a cycle for a one-way process, or a flow for unordered items.
- Don't put paragraphs inside nodes.
- Don't use more than one diagram per slide.
