# Layout: Hub and spoke

Use for: one central idea with 3–6 related parts (components of a system, factors affecting X,
applications of a technology).

## Structure
- Centre node: the main concept (strong colour, 1–3 words).
- 3–6 outer nodes evenly around it, each a short title + ≤ 6-word description, optional icon.
- Lines from centre to each node (no arrowheads unless direction matters).
- Engine component: `<figure class="v3-diagram" data-kind="hub">` (first li = centre).
  Give it a wide box (≥ 760×440) so outer labels have room.

## Skeleton

```html
<style>
.slide .hd{position:absolute;left:80px;top:56px;width:1120px;display:flex;flex-direction:column;gap:8px}
.slide .hd h2{font-size:48px;color:var(--ink)}
.slide .hd p{font-size:24px;color:var(--muted)}
</style>
<div class="hd"><h2>What a black hole is made of</h2><p>Four parts, from the outside in</p></div>
<figure class="v3-diagram" data-kind="hub" style="position:absolute;left:120px;top:190px;width:1040px;height:470px">
  <li><strong>Black hole</strong></li>
  <li><strong>Accretion disk</strong> hot gas spiralling in</li>
  <li><strong>Photon sphere</strong> light orbits here</li>
  <li><strong>Event horizon</strong> point of no return</li>
  <li><strong>Singularity</strong> where theory breaks down</li>
</figure>
```

## Variant — hub with icons built in HTML
A centre circle (220 px, var(--primary)) at the middle; four cards at the corners with a 48 px icon
each; thin SVG lines from the circle edge to each card edge (lines end at box edges, never through text).

## Don't
- Don't exceed 6 spokes — group extras.
- Don't let lines cross labels; don't put the deck title in the centre.
- Don't use hub for a sequence (that is a process).
