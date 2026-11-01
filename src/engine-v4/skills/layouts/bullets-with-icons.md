# Layout: Points with icons (the upgrade of a bullet list)

Use for: 3–4 parallel ideas (features, causes, benefits, types). Each idea gets an icon, a short
label and a one-line description.

## Structure
- Title / action title top-left, optional key message line.
- 3 cards in a row, 4 cards in a row or 2×2, each: icon (48–64 px) in a tinted circle or square,
  label (24–28 px, bold), description (19–22 px, muted, ≤ 12 words).
- All icons from one set, same size, same colour (see icons.md).

## Skeleton — 3 cards

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px;display:flex;flex-direction:column;gap:12px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .hd p{font-size:26px;color:var(--muted);max-width:900px}
.slide .cards{position:absolute;left:80px;top:250px;width:1120px;height:360px;display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.slide .card{background:var(--surface);border-radius:20px;padding:32px 28px;display:flex;flex-direction:column;gap:16px}
.slide .badge{width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--primary) 14%,transparent)}
.slide .badge .ic{width:44px;height:44px;color:var(--primary)}
.slide .card h3{font-size:27px;color:var(--ink)}
.slide .card p{font-size:21px;line-height:1.38;color:var(--muted)}
</style>
<div class="hd"><h2>GPUs run thousands of small jobs at once</h2><p>Why graphics chips became the engine of modern AI</p></div>
<div class="cards">
  <div class="card"><div class="badge"><i class="ic" data-icon="lucide:cpu"></i></div><h3>Many cores</h3><p>Thousands of simple cores instead of a few complex ones</p></div>
  <div class="card"><div class="badge"><i class="ic" data-icon="lucide:layers"></i></div><h3>Parallel maths</h3><p>Matrix sums split into pieces solved together</p></div>
  <div class="card"><div class="badge"><i class="ic" data-icon="lucide:gauge"></i></div><h3>Fast memory</h3><p>Wide memory bus keeps every core busy</p></div>
</div>
```

## Variants
- Icon left, text right, stacked vertically (good beside a photo on the right 40 %).
- 2×2 grid for 4 items with longer descriptions.
- No cards: icons on a thin horizontal rule, label below (lighter look).

## Don't
- Don't use an icon whose meaning is unclear for the label — use a number badge instead.
- Don't mix filled and outline icons, or different colours per card.
- Don't exceed 4 items; don't write paragraph descriptions.
