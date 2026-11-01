# Layout: Quote

Use for: a short, memorable statement by a real, named person that is in the brief/research.
≤ 30 words. Never invent or "improve" a quote; never attribute a quote without a source.

## Structure
- Big quotation mark (motif-coloured, 160–220 px, faded) as decoration.
- Quote text 34–44 px, heading or serif font, max ~45 characters per line, left-aligned or centred.
- Attribution: name (22–24 px, bold) + role/source (18–20 px, muted). Optional portrait photo
  in a circle (only if a photo of that person was provided).

## Skeleton

```html
<style>
.slide .mark{position:absolute;left:70px;top:60px;height:200px;overflow:visible;font-family:var(--font-heading);font-size:220px;line-height:1;color:color-mix(in srgb,var(--accent) 35%,transparent)}
.slide .q{position:absolute;left:140px;top:190px;width:1000px;display:flex;flex-direction:column;gap:32px}
.slide .q blockquote{margin:0;font-family:var(--font-heading);font-size:46px;line-height:1.25;color:var(--ink)}
.slide .who{display:flex;flex-direction:column;gap:4px;padding-left:18px;border-left:4px solid var(--primary)}
.slide .who strong{font-size:24px;color:var(--ink)}
.slide .who span{font-size:19px;color:var(--muted)}
</style>
<p class="mark" aria-hidden="true">“</p>
<div class="q">
  <blockquote>Sample quote text goes here, short enough to read in one breath.</blockquote>
  <div class="who"><strong>Person's name</strong><span>Role, source [n]</span></div>
</div>
```

## Don't
- Don't use a quote that is not in the research; don't paraphrase inside quotation marks.
- Don't place the quote over a busy photo.
- Don't add bullet points to a quote slide.
