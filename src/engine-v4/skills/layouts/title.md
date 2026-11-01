# Layout: Title slide

Use for: slide 1. The most striking slide of the deck; sets palette, fonts and motif.

## Structure
- Title (hero, 64–88 px if ≤ 7 words, else 52–64 px), optional subtitle (24–30 px).
- Presenter block: label small/muted (18–20 px), value larger (20–24 px). Only fields that were given,
  written as their placeholders `{{P1}}`, `{{P2}}`… exactly.
- One visual: a hero photo with a scrim, OR a typographic composition with motif shapes.
- University/organisation logo, if uploaded: small (height 56–88 px), in a corner or above the
  title. Never as background, never stretched, never the main visual.

## Skeleton A — photo hero with side scrim (landscape photo)

```html
<style>
.slide .hero{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:70% 50%}
.slide .scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,color-mix(in srgb,var(--bg) 90%,transparent) 45%,transparent 80%)}
.slide .logo{position:absolute;left:80px;top:56px;height:64px;width:auto;object-fit:contain}
.slide .copy{position:absolute;left:80px;top:150px;width:620px;display:flex;flex-direction:column;gap:18px}
.slide .kicker{font-size:18px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--primary)}
.slide h1{font-size:72px;line-height:1.04;color:var(--ink)}
.slide .sub{font-size:26px;line-height:1.35;color:var(--muted)}
.slide .rule{width:96px;height:6px;border-radius:3px;background:var(--accent)}
.slide .meta{display:grid;grid-template-columns:max-content 1fr;gap:6px 20px}
.slide .meta span{font-size:18px;color:var(--muted)}
.slide .meta strong{font-size:21px;color:var(--ink)}
</style>
<img class="hero" src="asset:img1" alt="">
<div class="scrim"></div>
<img class="logo" src="asset:logo" alt="University logo">
<div class="copy">
  <p class="kicker">Seminar · Physics</p>
  <h1>Black Holes</h1>
  <p class="sub">Where gravity wins against light</p>
  <div class="rule"></div>
  <div class="meta"><span>Presented by</span><strong>{{P1}}</strong><span>Roll No.</span><strong>{{P2}}</strong></div>
</div>
```

## Skeleton B — typographic, no photo

```html
<style>
.slide .band{position:absolute;left:0;top:0;width:430px;height:720px;background:var(--primary)}
.slide .big{position:absolute;left:40px;top:120px;width:360px;font-family:var(--font-heading);font-size:240px;line-height:1;color:color-mix(in srgb,var(--bg) 18%,transparent)}
.slide .logo{position:absolute;left:80px;top:56px;height:72px;width:auto;object-fit:contain}
.slide .copy{position:absolute;left:510px;top:0;bottom:0;width:690px;display:flex;flex-direction:column;justify-content:center;gap:20px}
.slide h1{font-size:64px;line-height:1.06;color:var(--ink)}
.slide .sub{font-size:26px;color:var(--muted);line-height:1.35}
.slide .who{display:flex;flex-direction:column;gap:6px;border-left:4px solid var(--accent);padding-left:18px;margin-top:12px}
.slide .who p{font-size:21px;color:var(--ink)}
.slide .who span{color:var(--muted)}
</style>
<div class="band"></div>
<p class="big" aria-hidden="true">01</p>
<div class="copy">
  <h1>Are We Living in a Simulation?</h1>
  <p class="sub">The argument, the evidence and the objections</p>
  <div class="who"><p><span>Presented by </span>{{P1}}</p><p><span>Department </span>{{P3}}</p></div>
</div>
```

## Variants
- Portrait photo: photo in a diagonal clip-path panel on the right 45 %, text on a solid field.
- Duotone: photo in grayscale with `mix-blend-mode:multiply` over a var(--primary) band.

## Don't
- Don't invent presenter names, roll numbers, guides, dates or "Your Name".
- Don't put the logo big, centred, as a watermark or behind the title.
- Don't use a busy photo behind the title without a scrim.
- Don't add bullets or agenda items to the title slide.
