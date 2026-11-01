# Layout: Section divider

Use for: starting a new part of a long deck (10+ slides). Quiet, bold, few words.

## Structure
- No giant section numbers (they collide with titles in this engine); the kicker "Part 2" carries the position.
- Section title (56–72 px) and one line of what this part answers (24–28 px).
- Optional: a thin progress row showing all sections with the current one highlighted.

## Skeleton

```html
<style>
.slide .bar{position:absolute;left:80px;top:300px;width:8px;height:150px;border-radius:4px;background:var(--accent)}
.slide .copy{position:absolute;left:120px;top:290px;width:760px;display:flex;flex-direction:column;gap:14px}
.slide .kicker{font-size:20px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--primary)}
.slide h2{font-size:64px;color:var(--ink)}
.slide .sub{font-size:26px;color:var(--muted)}
.slide .steps{position:absolute;left:80px;top:610px;width:1120px;display:flex;gap:12px}
.slide .steps span{flex:1;font-size:18px;color:var(--muted);border-top:4px solid color-mix(in srgb,var(--ink) 15%,transparent);padding-top:10px}
.slide .steps .on{color:var(--ink);font-weight:700;border-top-color:var(--accent)}
</style>
<div class="bar"></div>
<div class="copy">
  <p class="kicker">Part 2</p>
  <h2>How the Argument Works</h2>
  <p class="sub">Three possibilities, one of which must be true</p>
</div>
<div class="steps"><span>Background</span><span class="on">The argument</span><span>Evidence</span><span>Objections</span></div>
```

## Don't
- Don't use dividers in decks under ~10 slides — they waste slides.
- Don't add body text or images that compete with the section title.
