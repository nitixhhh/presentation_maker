# Layout: Team / people

Use for: group members, key scientists, stakeholders. ONLY people named in the brief.

## Structure
- 2–6 people in a row (or 2 rows of 3–4). Each: photo in a circle (only if provided) OR an
  initials avatar on a tinted circle, name (22–26 px bold), role/contribution (18–20 px muted).
- Student team slides: names and roll numbers come as placeholders ({{P1}}…) — write them exactly.
- Historical people: a portrait photo from search_photos with credit, plus the person's key contribution.

## Skeleton — four people, initials avatars

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .grid{position:absolute;left:80px;top:200px;width:1120px;min-height:420px;display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.slide .p{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:28px 18px;background:var(--surface);border-radius:20px}
.slide .av{width:150px;height:150px;border-radius:50%;background:color-mix(in srgb,var(--primary) 18%,transparent);display:flex;align-items:center;justify-content:center;border:4px solid var(--primary)}
.slide .av span{font-family:var(--font-heading);font-size:52px;font-weight:800;color:var(--primary)}
.slide .av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.slide .p h3{font-size:26px;color:var(--ink)}
.slide .p p{font-size:19px;line-height:1.35;color:var(--muted)}
</style>
<div class="hd"><h2>Our team</h2></div>
<div class="grid">
  <div class="p"><div class="av"><span>A</span></div><h3>{{P1}}</h3><p>Research and data</p></div>
  <div class="p"><div class="av"><span>B</span></div><h3>{{P2}}</h3><p>Design and slides</p></div>
  <div class="p"><div class="av"><span>C</span></div><h3>{{P3}}</h3><p>Experiments</p></div>
  <div class="p"><div class="av"><span>D</span></div><h3>{{P4}}</h3><p>Analysis and report</p></div>
</div>
```

## Don't
- Don't invent people, roles, photos or LinkedIn-style titles.
- Don't use stock photos of strangers as if they were team members.
- Don't use a generic "user" icon as a face — use initials.
