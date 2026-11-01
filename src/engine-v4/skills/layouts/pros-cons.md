# Layout: Pros and cons / advantages and limitations

Use for: the good and bad of ONE thing (a method, a policy, a technology).

## Structure
- Title names the subject ("Solar power: strengths and limits").
- Two columns: Pros (check icon, primary/positive colour) and Cons (x / alert icon, muted or accent2).
- 2–4 items per side, each ≤ 12 words. Equal count looks balanced but is not required.
- Optional verdict bar at the bottom: one sentence summarising the trade-off.

## Skeleton

```html
<style>
.slide .hd{position:absolute;left:80px;top:60px;width:1120px}
.slide .hd h2{font-size:50px;color:var(--ink)}
.slide .side{position:absolute;top:180px;width:536px;height:370px;display:flex;flex-direction:column;gap:24px}
.slide .pro{left:80px}.slide .con{left:664px}
.slide .side h3{font-size:30px;color:var(--ink);padding-bottom:10px;border-bottom:4px solid var(--primary)}
.slide .con h3{border-bottom-color:var(--accent2)}
.slide .item{display:flex;gap:16px;align-items:flex-start}
.slide .item .ic{flex:none;width:34px;height:34px;margin-top:2px;color:var(--primary)}
.slide .con .item .ic{color:var(--accent2)}
.slide .item p{font-size:25px;line-height:1.35;color:var(--ink)}
.slide .verdict{position:absolute;left:80px;top:584px;width:1120px;background:var(--surface);border-left:6px solid var(--accent);border-radius:12px;padding:18px 26px}
.slide .verdict p{font-size:23px;color:var(--ink)}
</style>
<div class="hd"><h2>Solar power: strengths and limits</h2></div>
<div class="side pro"><h3>Advantages</h3>
  <div class="item"><i class="ic" data-icon="lucide:circle-check"></i><p>No fuel cost once installed</p></div>
  <div class="item"><i class="ic" data-icon="lucide:circle-check"></i><p>No emissions while running</p></div>
  <div class="item"><i class="ic" data-icon="lucide:circle-check"></i><p>Works on rooftops and small sites</p></div></div>
<div class="side con"><h3>Limitations</h3>
  <div class="item"><i class="ic" data-icon="lucide:circle-x"></i><p>No output at night</p></div>
  <div class="item"><i class="ic" data-icon="lucide:circle-x"></i><p>Storage adds cost</p></div>
  <div class="item"><i class="ic" data-icon="lucide:circle-x"></i><p>Needs large area for big plants</p></div></div>
<div class="verdict"><p>Best paired with storage or another source for night-time demand.</p></div>
```

## Don't
- Don't rely only on green/red; the headings and icons must say it too.
- Don't use thumbs up/down clip-art or emoji.
