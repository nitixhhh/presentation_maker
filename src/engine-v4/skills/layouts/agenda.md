# Layout: Agenda / outline

Use for: listing 3–6 sections near the start. Show it as a designed sequence, not a bullet list.

## Structure
- Title ("Agenda", "What we'll cover", or a question).
- 3–6 items, each: number (big, accent), section name (24–28 px), optional ≤ 8-word description.
- Shape: row of tall cards (3–5 items) or numbered vertical path (4–6 items).
- Optional icon per item from one set (see icons.md), same size and colour.

## Skeleton — row of cards

```html
<style>
.slide .hd{position:absolute;left:80px;top:64px;width:1120px}
.slide .hd h2{font-size:52px;color:var(--ink)}
.slide .row{position:absolute;left:80px;top:190px;width:1120px;min-height:440px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.slide .card{background:var(--surface);border-radius:20px;padding:28px 24px;display:flex;flex-direction:column;gap:14px;border-top:6px solid var(--primary)}
.slide .card b{font-family:var(--font-heading);font-size:72px;color:var(--primary);line-height:1}
.slide .card .ic{width:52px;height:52px;color:var(--accent);margin-top:auto}
.slide .card h3{font-size:28px;color:var(--ink)}
.slide .card p{font-size:21px;line-height:1.35;color:var(--muted)}
</style>
<div class="hd"><h2>What we'll cover</h2></div>
<div class="row">
  <div class="card"><b>01</b><i class="ic" data-icon="lucide:book-open"></i><h3>Background</h3><p>Where the idea came from</p></div>
  <div class="card"><b>02</b><i class="ic" data-icon="lucide:git-branch"></i><h3>The argument</h3><p>Three possible futures</p></div>
  <div class="card"><b>03</b><i class="ic" data-icon="lucide:search"></i><h3>Evidence</h3><p>What physics can test</p></div>
  <div class="card"><b>04</b><i class="ic" data-icon="lucide:message-circle"></i><h3>Objections</h3><p>Why many disagree</p></div>
</div>
```

## Variant — vertical path (5–6 items)
A thin vertical line at x≈140 with numbered circles on it; each item's text to the right
(name 26 px + description 20 px), photo or motif band on the right 35 %.

## Don't
- Don't make a plain bulleted list of section names.
- Don't list more than 6 items (group them).
- Don't use different icon styles for different items.
