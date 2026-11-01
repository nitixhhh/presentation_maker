# Icons

Icons are small pictures that label a concept so the eye finds and groups it faster. They help
only when their meaning is clear AND they sit next to a word. Icons are not decoration.

## When to use icons
- 3–6 parallel items (features, causes, steps, categories, agenda sections) — one icon each.
- Labelling diagram nodes, timeline events, table checkmarks (✓ / ✗), stat labels.
- Replacing a word that repeats (a clock for "time", a rupee for "cost") only when the label stays.

## When NOT to use icons
- No clear concept to depict (abstract words like "framework", "synergy", "overview") — use a
  number badge or just strong type instead.
- On the title, quote, references and big-photo slides (one strong visual is enough).
- One icon alone floating as decoration; icons sprinkled in corners; icons as bullets on every line.
- More than ~6 icons on a slide, or icons on every slide of the deck.
- Never emoji, icon fonts, or clip-art; never draw your own icon paths when a library icon exists.

## The rules
1. Always pair an icon with a text label. Very few icons are universally understood (home,
   search, print, play); everything else is ambiguous without a word.
2. One icon set per deck. Lucide is the default (outline, 2 px stroke, round caps). Tabler matches
   Lucide's outline style and is fine to mix for missing concepts. Never mix outline and filled styles.
3. Same size for same-level icons on a slide. Sizes on the 1280×720 canvas:
   - inline with text / table cell: 24–32 px
   - card or list icon: 40–56 px
   - feature/hero icon (one per slide, max): 72–120 px
   - never below 24 px (unreadable on a projector)
4. Same colour for same-level icons: usually var(--primary); var(--accent) for the ONE item you
   highlight. Icons inherit `color` (stroke = currentColor).
5. Keep the stroke weight unchanged (2 at 24 px scales visually with size). Don't make some icons
   thicker than others.
6. Containers are optional but consistent: either all icons in tinted circles/squares (icon at
   ~50–55 % of the container) or none.
7. Align icons on the same baseline/top line as their labels; icon left of or above the label,
   the same way for every item.
8. Contrast: icons that carry meaning need at least 3:1 against their background (WCAG non-text contrast).

## How to search by concept
- Search the thing, not the slide title: "gpu" not "AI hardware revolution".
- Try 2–3 synonyms if the first search is weak:

| Concept | Try |
|---|---|
| GPU / graphics card | gpu, chip, cpu, circuit-board, processor |
| Computer | computer, monitor, laptop, desktop, server |
| Planet / space | planet, orbit, globe, rocket, telescope, satellite, moon, sun |
| Science | atom, flask, microscope, dna, test-tube, magnet |
| Biology / health | dna, heart, heart-pulse, brain, leaf, virus, pill, stethoscope |
| Money / economy | money, rupee, wallet, coins, banknote, chart-up, trending-up |
| Education | school, graduation-cap, book, book-open, pencil, notebook |
| People | user, users, user-group, handshake, id-badge |
| Data | database, chart-bar, chart-line, pie-chart, table, file-spreadsheet |
| Time | clock, calendar, hourglass, history, timer |
| Direction / flow | arrow-right, arrow-up-right, move-right, git-branch, workflow, repeat, refresh |
| Warning / problem | alert-triangle, alert-circle, shield-alert, bug, x-circle |
| Success / yes | check, circle-check, badge-check, thumbs-up (avoid thumbs in formal decks) |
| Idea | lightbulb, sparkles, brain |
| Environment | leaf, tree, droplet, sun, wind, recycle, factory |
| Network / internet | wifi, globe, network, cloud, link, server |
| Security | lock, shield, key, fingerprint |

- Hindi/Hinglish queries work too ("paisa", "padhai") if the index has them, but English concept
  words give the best results.
- Pick the result whose picture you would recognise without the label. If none fits after
  3 searches, use a number badge or a word — never a random icon.

## Markup

```html
<div class="item">
  <span class="badge"><i class="ic" data-icon="lucide:cpu"></i></span>
  <h3>Many cores</h3>
</div>
<style>
.slide .badge{width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--primary) 14%,transparent)}
.slide .badge .ic{width:44px;height:44px;color:var(--primary)}
</style>
```

The engine replaces `<i class="ic" data-icon="set:name">` with the inline SVG. Size it with
width/height on `.ic`; colour it with `color`.

## Don't
- Don't use a lightbulb for every "idea" and a rocket for every "growth" — choose the specific concept.
- Don't use flags, religious symbols or hand gestures casually; meanings differ by culture.
- Don't put text inside an icon or rotate icons for effect.
- Don't let icons be bigger or louder than the title.
