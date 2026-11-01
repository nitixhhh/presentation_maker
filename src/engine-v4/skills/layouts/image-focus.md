# Layout: Image focus

Use for: when a photo carries the point (a place, an object, an event, a specimen). The photo
is the slide; text is minimal. Read images.md for cropping, scrims and credits.

## Structure
- Full-bleed photo (object-fit:cover, deliberate object-position), OR a 55–65 % bleed panel.
- Gradient scrim on the calm side for text, or a solid caption card.
- Title (44–56 px) + 1–2 lines (24–26 px). Optional small labels pointing at parts of the photo
  (leader lines that end at the feature, labels ≥ 18 px on a solid chip).

## Skeleton — full bleed + caption card

```html
<style>
.slide .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%}
.slide .scrim{position:absolute;left:0;right:0;bottom:0;height:380px;background:linear-gradient(0deg,color-mix(in srgb,#000 78%,transparent) 0%,transparent 100%)}
.slide .cap{position:absolute;left:80px;top:460px;width:760px;display:flex;flex-direction:column;gap:12px}
.slide .cap h2{font-size:52px;color:#fff}
.slide .cap p{font-size:25px;line-height:1.35;color:rgba(255,255,255,.9)}
</style>
<img class="ph" src="asset:img2" alt="Event Horizon Telescope image of M87">
<div class="scrim"></div>
<div class="cap">
  <h2>The first photo of a black hole</h2>
  <p>A ring of hot gas around a shadow 6.5 billion times the Sun's mass.<sup>[4]</sup></p>
</div>
```

## Variants
- Split: photo bleeds off the right edge at 55 % width; text block on a solid field at left.
- Cinematic band: photo as a 1280×300 band across the middle, title above, caption below.
- Annotated photo: 2–3 labels with thin leader lines on solid chips.

## Don't
- Don't use a low-resolution or watermarked photo; don't stretch (always object-fit:cover).
- Don't put text over faces or the busy part of the photo; always scrim or card behind text.
- Don't use the university logo as the photo (see images.md logo rules).
