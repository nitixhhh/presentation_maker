# Layout: Two-column comparison (A vs B)

Use for: comparing two options, methods, eras or theories on the same criteria.

## Structure
- Title states the verdict or the question ("Classical vs quantum bits").
- Two equal panels, each with a header (name + optional icon) and 3–4 rows.
- Rows line up across panels: the same criterion at the same height.
- A small "VS" badge or a thin divider in the middle. One panel can carry the accent if it "wins".
- For 3+ criteria with short values, prefer layouts/table.md.

## Skeleton

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .cols{position:absolute;left:80px;top:190px;width:1120px;height:440px;display:grid;grid-template-columns:1fr 1fr;gap:64px}
.slide .col{background:var(--surface);border-radius:22px;padding:30px 34px;display:flex;flex-direction:column;gap:18px}
.slide .col.win{border:3px solid var(--accent)}
.slide .top{display:flex;align-items:center;gap:14px}
.slide .top .ic{width:44px;height:44px;color:var(--primary)}
.slide .top h3{font-size:32px;color:var(--ink)}
.slide .col ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:14px}
.slide .col li{font-size:22px;line-height:1.35;color:var(--ink);padding-top:12px;border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
.slide .col li strong{display:block;font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.slide .vs{position:absolute;left:608px;top:380px;width:64px;height:64px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center}
.slide .vs span{font-family:var(--font-heading);font-weight:800;font-size:22px;color:var(--bg)}
</style>
<div class="hd"><h2>Classical bits vs quantum bits</h2></div>
<div class="cols">
  <div class="col"><div class="top"><i class="ic" data-icon="lucide:binary"></i><h3>Classical bit</h3></div>
    <ul><li><strong>State</strong>Either 0 or 1</li><li><strong>Scaling</strong>n bits hold one value</li><li><strong>Errors</strong>Very rare, easy to fix</li></ul></div>
  <div class="col win"><div class="top"><i class="ic" data-icon="lucide:atom"></i><h3>Qubit</h3></div>
    <ul><li><strong>State</strong>A blend of 0 and 1</li><li><strong>Scaling</strong>n qubits explore many values</li><li><strong>Errors</strong>Fragile, needs cooling</li></ul></div>
</div>
<div class="vs"><span>VS</span></div>
```

## Don't
- Don't compare different criteria on each side (rows must match).
- Don't make the two panels different sizes unless one is clearly the focus.
- Don't use red/green alone to signal better/worse (add words or icons).
