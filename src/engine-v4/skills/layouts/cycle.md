# Layout: Cycle

Use for: steps that repeat in a loop (water cycle, product life cycle, PDCA, feedback loops).
3–6 stages. If there is a clear start and end, use process-steps instead.

## Structure
- Cycle diagram on one side (≈ 560×520 box), explanation on the other (title, key message, 1–2 lines).
- Stage labels 1–3 words; arrows all in the same direction (clockwise).
- Engine component: `<figure class="v3-diagram" data-kind="cycle">` draws the ring and arrows
  to fit your box — prefer it (or make_diagram kind "cycle") over hand-drawn SVG.

## Skeleton

```html
<style>
.slide .copy{position:absolute;left:80px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:20px}
.slide .copy h2{font-size:50px;color:var(--ink)}
.slide .copy .key{font-size:28px;line-height:1.3;color:var(--primary);font-weight:600}
.slide .copy p{font-size:22px;line-height:1.4;color:var(--muted)}
</style>
<div class="copy">
  <h2>The water cycle never stops</h2>
  <p class="key">The same water moves between sea, sky and land.</p>
  <p>The sun drives evaporation; gravity brings the water back.</p>
</div>
<figure class="v3-diagram" data-kind="cycle" data-size="25" style="position:absolute;left:620px;top:90px;width:580px;height:540px">
  <li><strong>Evaporation</strong> sun heats the sea</li>
  <li><strong>Condensation</strong> vapour forms clouds</li>
  <li><strong>Precipitation</strong> rain and snow fall</li>
  <li><strong>Collection</strong> rivers return to sea</li>
</figure>
```

## Don't
- Don't put long sentences inside the ring nodes.
- Don't add a centre label that overlaps the arrows; put the cycle's name in the title.
- Don't use a cycle for a one-way process.
