# Charts and data

A chart exists to make ONE comparison obvious. Decide the message first, then the chart.

## Only real numbers
- Plot only numbers that appear in the slide's points/research. Never estimate, extrapolate,
  "fill in" a missing year, or convert qualitative claims into numbers.
- Every chart gets a source line (the given source label) or citation marker.
- Fewer than 3 numbers → big-number layout, not a chart.

## Choosing the chart

| What you want to show | Chart | Notes |
|---|---|---|
| Change over time (many points) | Line | Time on x-axis left→right; ≤ 4 lines |
| Change over time (few periods, ≤ 8) | Vertical bars (columns) | |
| Compare categories / ranking | Horizontal bars | Sort largest→smallest; long labels fit |
| Parts of a whole (2–5 parts) | Donut or 100 % stacked bar | Only if parts sum to 100 %; else bars |
| Parts of a whole changing over time | Stacked bars / stacked area | ≤ 4 segments |
| Relationship between two variables | Scatter | Needs many points; rare on student slides |
| One number vs a target | Big number + progress bar | |
| Exact values matter more than the shape | Table | |

Engine support: bars → `<figure class="v3-diagram" data-kind="bars">` with
`<li data-value="42" data-unit="%">Label</li>`. Line/donut/stacked → make_diagram
`{kind:"chart", chart:"line"|"donut"|"stacked", series:[…]}`. If a chart type is not available,
use bars or a table — never hand-draw a chart in SVG.

## Labelling
- Title states the insight: "Exports doubled after 2020", not "Exports 2015–2023".
- Label data directly (value at the end of each bar, name at the end of each line) instead of a legend.
- Axis labels only when the unit is not obvious; always show units (%, ₹ crore, km, °C).
- Use the same number format everywhere (1,250 or 1.25k — not both). Indian decks may use lakh/crore
  if the source does; don't convert units yourself.
- Remove gridlines or make them very light; no chart borders or background boxes.
- Label text ≥ 18 px.

## Highlight the insight
- Base colour for all data: var(--primary) or a muted tint.
- The bar/line/segment the message is about: var(--accent). One highlight per chart.
- Add a callout: the key number large + one sentence explaining why it matters.

## Honesty rules
- Bar charts start at zero. Line charts may zoom the axis, but say so if the change looks dramatic.
- No 3D, no perspective, no shadows, no exploded pies, no gradient bars, no rainbow palettes.
- Don't use a pie for more than 5 slices or for values that do not add up to a whole.
- Keep aspect sensible: don't stretch a line chart to exaggerate a slope.
- Same scale when two charts are compared side by side.

## Example (bars with highlight)

```html
<figure class="v3-diagram" data-kind="bars" style="position:absolute;left:80px;top:180px;width:720px;height:420px">
  <li data-value="31" data-unit="%">Coal</li>
  <li data-value="24" data-unit="%">Gas</li>
  <li data-value="18" data-unit="%">Solar</li>
</figure>
```
(Sample values — use your brief's numbers. Put the insight in a callout beside the chart.)

## Don't
- Don't chart decorative or invented numbers.
- Don't put two different units on one chart (dual axes confuse).
- Don't show more than ~8 bars or ~4 lines on one slide.
- Don't make the audience read a legend to understand the point.
