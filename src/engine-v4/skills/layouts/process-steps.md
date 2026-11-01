# Layout: Process / steps

Use for: an ordered sequence with a start and an end (method, algorithm, how something is made).
3–5 steps. If the last step feeds back to the first, use layouts/cycle.md.

## Structure
- Title (action title) and optional one-line intro.
- Steps left→right (or top→bottom if the steps have long text), each: number badge, short title
  (1–4 words), description (≤ 10 words). Arrows between steps.
- Optional takeaway bar under the steps.
- Fast path: make_diagram({kind:"flow", items:[…], box:{left:80,top:220,width:1120,height:320}}).

## Skeleton — chevron row built with HTML

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px;display:flex;flex-direction:column;gap:10px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .hd p{font-size:25px;color:var(--muted)}
.slide .flow{position:absolute;left:80px;top:240px;width:1120px;min-height:290px;display:flex;gap:48px}
.slide .step{flex:1;position:relative;background:var(--surface);border-radius:18px;padding:24px 22px;display:flex;flex-direction:column;gap:12px}
.slide .step:not(:last-child)::after{content:"";position:absolute;right:-34px;top:50%;width:20px;height:20px;border-top:4px solid var(--accent);border-right:4px solid var(--accent);transform:translateY(-50%) rotate(45deg)}
.slide .n{width:52px;height:52px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center}
.slide .n span{font-family:var(--font-heading);font-weight:800;font-size:24px;color:var(--bg)}
.slide .step h3{font-size:26px;color:var(--ink)}
.slide .step p{font-size:20px;line-height:1.35;color:var(--muted)}
.slide .take{position:absolute;left:80px;top:580px;width:1120px;background:var(--primary);border-radius:14px;padding:18px 28px}
.slide .take p{font-size:23px;font-weight:600;color:var(--bg)}
</style>
<div class="hd"><h2>How a vaccine trains the immune system</h2><p>Four steps from injection to protection</p></div>
<div class="flow">
  <div class="step"><div class="n"><span>1</span></div><h3>Injection</h3><p>A harmless piece of the virus enters</p></div>
  <div class="step"><div class="n"><span>2</span></div><h3>Detection</h3><p>Immune cells spot the foreign shape</p></div>
  <div class="step"><div class="n"><span>3</span></div><h3>Response</h3><p>Antibodies are made against it</p></div>
  <div class="step"><div class="n"><span>4</span></div><h3>Memory</h3><p>Memory cells stay ready for years</p></div>
</div>
<div class="take"><p>A later real infection is stopped before it spreads.</p></div>
```

## Variants
- Vertical numbered steps on the left 55 % with a photo band on the right.
- Icons instead of numbers when each step has a clear concept icon (keep numbers if order matters).

## Don't
- Don't draw arrows that point at nothing or cross text.
- Don't use more than 5 steps on one slide; group them into phases instead.
- Don't make steps different sizes without a reason.
