# Layout: References

Use for: the sources slide (usually last or second-to-last). Calm, readable, complete. Read
academic.md for reference formatting.

## Structure
- Title "References" (same style as other content titles, smaller decoration).
- Numbered list in the exact order and text given, `[1] … [n]`, hanging indent.
- 15–18 px text; two columns when there are more than 5 references.
- Long URLs/DOIs must wrap: `overflow-wrap:anywhere; word-break:break-word` on every item.
- Image credits (if any) in a small block below (13–15 px, muted), provided by the engine.
- More than ~12 references: split across two References slides rather than shrinking.

## Skeleton

```html
<style>
.slide .hd{position:absolute;left:80px;top:56px;width:1120px}
.slide .hd h2{font-size:44px;color:var(--ink)}
.slide .refs{position:absolute;left:80px;top:150px;width:1120px;height:430px;columns:2;column-gap:56px}
.slide .refs ol{list-style:none;padding:0;margin:0}
.slide .refs li{break-inside:avoid;display:grid;grid-template-columns:44px 1fr;gap:4px;margin-bottom:14px}
.slide .refs li span{font-size:17px;font-weight:700;color:var(--primary)}
.slide .refs li p{font-size:17px;line-height:1.4;color:var(--ink);overflow-wrap:anywhere;word-break:break-word}
.slide .credits{position:absolute;left:80px;top:600px;width:1120px;display:flex;flex-direction:column;gap:4px}
.slide .credits p{font-size:14px;line-height:1.35;color:var(--muted);overflow-wrap:anywhere}
</style>
<div class="hd"><h2>References</h2></div>
<div class="refs"><ol>
  <li><span>[1]</span><p>Author, A. A. (2020). Title of the article. Journal Name, 12(3), 45–67. https://doi.org/10.xxxx/xxxxx</p></li>
  <li><span>[2]</span><p>Wikipedia contributors. (2026). Black hole. In Wikipedia. https://en.wikipedia.org/wiki/Black_hole</p></li>
</ol></div>
<div class="credits"><p>Image credits: Title of image — Author, CC BY 4.0, via Wikimedia Commons</p></div>
```

## Don't
- Don't change, reorder, shorten or invent references; list exactly what the engine gives.
- Don't let a URL run past the column or slide edge.
- Don't add photos or big decoration to the references slide.
