# Layout: Chart slide

Use for: a series of numbers from the brief (trend, ranking, share). Read charts-data.md for
which chart to choose. The chart is the main visual (≥ 55 % of the slide), with the insight stated.

## Structure
- Action title that states the insight ("Exports doubled after 2020"), not "Exports chart".
- Chart box 640–760 px wide on one side; insight callout (key number + 1–2 lines) on the other.
- Highlight the bar/point that matters in var(--accent); others in var(--primary) or muted.
- Source line under the chart (16 px, muted) using the given source label.
- Bar charts: engine component `<figure class="v3-diagram" data-kind="bars">` with
  `<li data-value="42" data-unit="%">Label</li>`. Other chart types: make_diagram (see charts-data.md).

## Skeleton — bars + insight

```html
<style>
.slide .hd{position:absolute;left:80px;top:56px;width:1120px}
.slide .hd h2{font-size:48px;color:var(--ink)}
.slide .insight{position:absolute;left:840px;top:200px;width:360px;display:flex;flex-direction:column;gap:14px;padding:28px;background:var(--surface);border-radius:20px;border-left:6px solid var(--accent)}
.slide .insight b{font-family:var(--font-heading);font-size:72px;line-height:1;color:var(--accent)}
.slide .insight p{font-size:22px;line-height:1.38;color:var(--ink)}
.slide .src{position:absolute;left:80px;top:636px;width:720px;font-size:18px;color:var(--muted)}
</style>
<div class="hd"><h2>Smartphone users tripled in eight years</h2></div>
<figure class="v3-diagram" data-kind="bars" style="position:absolute;left:80px;top:180px;width:720px;height:430px">
  <li data-value="250" data-unit="M">2015</li>
  <li data-value="420" data-unit="M">2018</li>
  <li data-value="600" data-unit="M">2021</li>
  <li data-value="750" data-unit="M">2023</li>
</figure>
<div class="insight"><b>3×</b><p>Cheap data plans drove most of the growth after 2016.<sup>[3]</sup></p></div>
<p class="src">Source: [3] National survey</p>
```

(Sample values only.)

## Don't
- Don't plot numbers that are not in the brief; don't create a chart from qualitative points.
- No 3D, no shadows on bars, no rainbow colours, no legend when direct labels fit.
- Don't start a bar chart's value axis above zero.
