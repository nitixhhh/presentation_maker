# Layout: Big numbers / statistics

Use for: 1–3 numbers that ARE the message (a growth rate, a size, a count). Numbers must come
from the brief, each with its source marker.

## Structure
- One hero number (140–220 px) with a short label, OR 3 numbers in a row (80–110 px each).
- Each number: value (accent or primary, heading font, heavy), unit inside or next to it,
  label (22–26 px) saying what it counts, optional context line (18–20 px, muted) + `<sup>[n]</sup>`.
- Title or key message states what the numbers mean together.

## Skeleton — three statistics

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px;display:flex;flex-direction:column;gap:10px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .hd p{font-size:26px;color:var(--muted)}
.slide .stats{position:absolute;left:80px;top:250px;width:1120px;height:300px;display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
.slide .st{display:flex;flex-direction:column;gap:10px;padding-top:24px;border-top:6px solid var(--primary)}
.slide .st:nth-child(2){border-top-color:var(--accent)}
.slide .st b{display:block;font-family:var(--font-heading);font-size:96px;line-height:1.1;color:var(--ink);margin-bottom:6px}
.slide .st b small{font-size:44px;line-height:1;color:var(--muted)}
.slide .st h3{font-size:25px;color:var(--ink)}
.slide .st p{font-size:19px;line-height:1.35;color:var(--muted)}
</style>
<div class="hd"><h2>India's solar capacity grew fast</h2><p>Three numbers from the national energy report</p></div>
<div class="stats">
  <div class="st"><b>72<small>GW</small></b><h3>Installed capacity</h3><p>As of the report year<sup>[1]</sup></p></div>
  <div class="st"><b>12<small>×</small></b><h3>Growth in a decade</h3><p>Compared with ten years earlier<sup>[1]</sup></p></div>
  <div class="st"><b>4th</b><h3>Rank worldwide</h3><p>By installed solar capacity<sup>[2]</sup></p></div>
</div>
```

(Sample numbers only — use the numbers in your brief; never invent or round them differently.)

## Variant — one hero number
Number 200 px on the left 55 % (with a faded giant version behind it), meaning + context on the right,
or a full-bleed photo with the number on the scrim side.

## Don't
- Don't invent, estimate or "round up" numbers; no number without a source in the brief.
- Don't show more than 3 big numbers; more numbers → chart or table.
- Don't add decorative numerals that could be mistaken for data.
