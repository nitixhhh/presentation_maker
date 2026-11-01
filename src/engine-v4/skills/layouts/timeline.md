# Layout: Timeline

Use for: events in chronological order (history, project phases, milestones). 3–6 events.
For 7+ events, group into periods or split across two slides.

## Structure
- Title, then a horizontal line across the slide with dots at each event.
- Each event: date/year (accent, 26–32 px bold), label (22–24 px), optional ≤ 8-word detail (18–20 px).
- Labels alternate above/below the line when there are 5–6 events (more room per label).
- Spacing should be even (equal gaps) unless the real time gaps are the point.
- Or use make_diagram({kind:"timeline", …}) / `<figure class="v3-diagram" data-kind="timeline">`.

## Skeleton — horizontal, labels below

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .line{position:absolute;left:80px;top:330px;width:1120px;height:4px;border-radius:2px;background:color-mix(in srgb,var(--primary) 35%,transparent)}
.slide .events{position:absolute;left:80px;top:300px;width:1120px;display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.slide .ev{display:flex;flex-direction:column;gap:10px}
.slide .dot{width:64px;height:64px;border-radius:50%;background:var(--surface);border:4px solid var(--primary);display:flex;align-items:center;justify-content:center}
.slide .dot .ic{width:30px;height:30px;color:var(--primary)}
.slide .ev.now .dot{background:var(--primary)}
.slide .ev.now .dot .ic{color:var(--bg)}
.slide .ev b{font-family:var(--font-heading);font-size:30px;color:var(--accent);margin-top:8px}
.slide .ev h3{font-size:24px;color:var(--ink)}
.slide .ev p{font-size:20px;line-height:1.35;color:var(--muted)}
</style>
<div class="hd"><h2>From theory to first image</h2></div>
<div class="line"></div>
<div class="events">
  <div class="ev"><div class="dot"><i class="ic" data-icon="lucide:scroll-text"></i></div><b>1916</b><h3>Prediction</h3><p>Equations allow a region light cannot leave</p></div>
  <div class="ev"><div class="dot"><i class="ic" data-icon="lucide:telescope"></i></div><b>1971</b><h3>First candidate</h3><p>X-rays from Cygnus X-1</p></div>
  <div class="ev"><div class="dot"><i class="ic" data-icon="lucide:audio-waveform"></i></div><b>2015</b><h3>Waves detected</h3><p>Two black holes merge</p></div>
  <div class="ev now"><div class="dot"><i class="ic" data-icon="lucide:camera"></i></div><b>2019</b><h3>First image</h3><p>The shadow of M87*</p></div>
</div>
```

(Sample dates are illustrative only — use the dates from your brief, never these.)

## Variants
- Vertical timeline on the left 55 % with a portrait photo band on the right.
- Period bands: coloured blocks proportional to duration, labels inside.

## Don't
- Don't invent dates to fill a slot; fewer events are fine.
- Don't let labels run into the next event (fix the column width, cut words).
- Don't draw the line through the text.
