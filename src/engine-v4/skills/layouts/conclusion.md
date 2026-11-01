# Layout: Conclusion / summary / thank-you

Use for: the last content slide (key takeaways) and/or the closing slide (thank you + questions).

## Structure — takeaways
- Title: "Key takeaways" or an action title summarising the deck.
- 3 takeaways (never more than 4), each numbered or with an icon, ≤ 15 words.
- Optional strong final line (the one thing to remember) in the accent colour.

## Structure — closing
- Echo the title slide's composition (same photo treatment or same band) so the deck feels bookended.
- "Thank you" / "Questions?" (64–96 px), one line recapping the core idea, presenter name placeholder
  if given. University logo allowed here, small.

## Skeleton — takeaways + thanks

```html
<style>
.slide .left{position:absolute;left:0;top:0;width:440px;height:720px;background:var(--primary)}
.slide .thanks{position:absolute;left:70px;top:0;bottom:0;width:320px;display:flex;flex-direction:column;justify-content:center;gap:16px}
.slide .thanks h2{font-size:64px;color:var(--bg)}
.slide .thanks p{font-size:22px;line-height:1.4;color:color-mix(in srgb,var(--bg) 85%,transparent)}
.slide .list{position:absolute;left:520px;top:0;bottom:0;width:680px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.slide .list h3{font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:var(--primary)}
.slide .tk{display:flex;gap:20px;align-items:flex-start}
.slide .tk b{flex:none;width:52px;height:52px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-size:24px;color:var(--bg)}
.slide .tk p{font-size:25px;line-height:1.35;color:var(--ink)}
</style>
<div class="left"></div>
<div class="thanks"><h2>Thank you</h2><p>Questions are welcome.</p><p>{{P1}}</p></div>
<div class="list">
  <h3>Key takeaways</h3>
  <div class="tk"><b>1</b><p>Nothing, not even light, escapes past the event horizon.</p></div>
  <div class="tk"><b>2</b><p>We detect black holes by their effect on gas, stars and light.</p></div>
  <div class="tk"><b>3</b><p>The 2019 image confirmed the shadow that theory predicted.</p></div>
</div>
```

## Don't
- Don't introduce new facts on the conclusion slide.
- No question-mark clip-art, no "Any questions???" in giant gradient text.
- Don't put contact details nobody gave (emails, phone numbers, websites).
