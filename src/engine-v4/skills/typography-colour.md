# Typography and colour

## Fonts available (the art director picks ONE pair per deck)

| Pair id | Headings | Body | Good for |
|---|---|---|---|
| geometric | Poppins | Inter | tech, startups, general student decks |
| editorial | Playfair Display | Source Sans 3 | humanities, history, literature |
| scholarly | Merriweather | Open Sans | research, science, formal academic |
| technical | Space Grotesk | IBM Plex Sans | engineering, CS, data |
| modern | Montserrat | Lato | business, marketing |
| classic | Lora | Lato | education, social sciences |
| bold | Oswald | Roboto | sports, impact statements (condensed — keep titles short) |
| friendly | DM Serif Display | DM Sans | school projects, creative topics |
| hindi-sans (Hindi decks) | Mukta | Noto Sans Devanagari | Devanagari text |

Use only var(--font-heading) and var(--font-body). Never add other fonts. In PPTX each font maps to
an Office-safe twin (e.g. Poppins→Century Gothic), so avoid layouts that only work at an exact width.

## Sizes on the 1280×720 canvas (projector distance)

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Hero title (title slide, ≤ 7 words) | 72–88 px | 700–800 | 1.0–1.1 |
| Slide title | 44–60 px | 700 | 1.1–1.15 |
| Key message / subtitle | 28–36 px | 500–600 | 1.25–1.3 |
| Body / points | 24–30 px | 400 | 1.3–1.45 |
| Card description | 20–22 px | 400 | 1.35 |
| Labels, captions, diagram text | 18–22 px (never < 18) | 500–700 | 1.2 |
| Source lines, footnotes | 16–18 px, ≤ 6 words, or ≥ 20 px if longer | 400 | 1.3 |
| References slide | 15–18 px | 400 | 1.4 |
| Big numbers (real data only, never decorative slide numbers) | 80–140 px | 800 | 1.0–1.1 |

Rules: steps between levels ≥ 1.3×; max two weights per font on a slide; line length 35–60
characters (set a width on the text box); left-align multi-line text; avoid ALL CAPS except short
kickers/labels (add letter-spacing .08–.2em); no italic paragraphs; no underlines except links.

Hindi (Devanagari): use 10–15 % larger sizes than Latin, line-height ≥ 1.5, never letter-spacing.
Hinglish decks use Roman script with normal sizes.

## Contrast (WCAG, the measurable rule)
- Normal text needs ≥ 4.5:1 against its background; large text (≥ 24 px regular or ≥ 19 px bold) ≥ 3:1.
- For projectors, aim higher: titles and body ≥ 7:1 (projectors wash colours out).
- Icons, chart bars, diagram lines and borders that carry meaning: ≥ 3:1.
- Muted text (var(--muted)) only for secondary info, never for key content; still ≥ 4.5:1.
- Text on photos: always a scrim or card (see images.md).
- Never: light grey on white, yellow on white, red on green/blue, saturated text on saturated background.

## Palette: 1 primary + 1 accent (+ neutrals)
- --bg and --surface: neutrals (off-white / paper, or deep navy / charcoal for dark).
- --ink: near-black (light theme) or near-white (dark theme) for all main text.
- --muted: secondary text.
- --primary: the brand/topic colour — titles accents, main shapes, diagram nodes.
- --accent: the highlight — the ONE thing per slide you want noticed (a number, a step, a bar).
- --accent2: rarely; a second category in charts or "cons" in pros/cons.
- 60-30-10 feel: ~60 % background, ~30 % primary/surface elements, ~10 % accent.
- Tints for panels: `color-mix(in srgb, var(--primary) 10–18%, transparent)`.
- Colour carries meaning consistently: if accent = "important" on slide 3, it means that everywhere.
- Never use colour alone to carry meaning (colour-blind viewers): add labels, icons or position.

## Light vs dark themes
- Light (off-white bg, dark ink): best for bright classrooms, text-heavy and data slides, printing.
- Dark (navy/charcoal bg, light ink): dramatic, photo-led and tech decks; dark rooms.
- Dark theme: avoid pure #000 and pure #fff (use #0f172a-like and #f1f5f9-like); raise muted
  text brightness; slightly lighter weights look bolder on dark.
- Do not switch theme between slides (a dark title + light content is fine if planned by the art director).

## Example: good title block

```css
.slide .hd h2{font-size:52px;line-height:1.1;color:var(--ink)}
.slide .hd p{font-size:28px;line-height:1.3;color:var(--muted);max-width:900px}
.slide .hd .kicker{font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:var(--primary);font-weight:700}
```

## Don't
- Don't shrink text to fit — cut words.
- Don't use more than 3 text sizes in the body of one slide.
- Don't use gradient-filled or outlined text for body content.
- Don't centre-align paragraphs or bullets.
