# Layout: Table

Use for: several items compared on several attributes (≤ 5 rows × ≤ 4 columns of SHORT values).
If cells need sentences, use cards or a comparison instead.

## Structure
- Action title stating what the table shows.
- Real `<table>` (td/th are text elements). Header row: bold, primary background or strong
  bottom border. Body rows: 22–24 px, generous padding (14–18 px), thin row dividers or zebra tint.
- Left-align text, right-align numbers (same decimals). Highlight one row/cell with the accent.
- Optional: ✓/✗ icons via `<i class="ic" data-icon="lucide:check">` instead of words.

## Skeleton

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px}
.slide .hd h2{font-size:48px;color:var(--ink)}
.slide .tb{position:absolute;left:80px;top:180px;width:1120px}
.slide table{width:100%;border-collapse:collapse}
.slide th{font-size:20px;letter-spacing:.06em;text-transform:uppercase;text-align:left;color:var(--bg);background:var(--primary);padding:16px 20px}
.slide td{font-size:23px;color:var(--ink);padding:16px 20px;border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
.slide td.num,.slide th.num{text-align:right}
.slide tr.hl td{background:color-mix(in srgb,var(--accent) 16%,transparent);font-weight:700}
.slide .note{position:absolute;left:80px;top:600px;width:1120px;font-size:18px;color:var(--muted)}
</style>
<div class="hd"><h2>Lithium-ion leads on energy density</h2></div>
<div class="tb"><table>
  <tr><th>Battery type</th><th class="num">Energy (Wh/kg)</th><th>Lifespan</th><th>Main use</th></tr>
  <tr><td>Lead-acid</td><td class="num">35</td><td>Short</td><td>Car starters</td></tr>
  <tr><td>Nickel-metal hydride</td><td class="num">80</td><td>Medium</td><td>Hybrid cars</td></tr>
  <tr class="hl"><td>Lithium-ion</td><td class="num">200</td><td>Long</td><td>Phones, EVs</td></tr>
</table></div>
<p class="note">Source: [2] sample label</p>
<!-- Sample values only: use the figures in your brief, with source markers. -->
```

## Don't
- Don't exceed ~20 cells; don't shrink table text below 20 px to fit — cut rows/columns.
- Don't use heavy borders on every cell (grid jail); dividers between rows are enough.
- Don't centre long text in cells.
