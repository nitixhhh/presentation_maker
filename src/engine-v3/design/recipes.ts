/**
 * Engine v3 — design recipe library.
 *
 * 38 example slides made by hand as HTML/CSS on the 1280×720 canvas. They are NOT layouts to fill:
 * for every slide the engine picks 2–3 relevant ones and shows them to the designer AI as INSPIRATION
 * (technique, hierarchy, how to treat a photo), with the instruction to design something of its own.
 * They use the deck CSS variables (--bg, --surface, --ink, --muted, --primary, --accent, --accent2,
 * --font-heading), so they read correctly in any palette. Content in them is sample content only.
 */
export interface Recipe {
  id: string;
  name: string;
  tags: string[];
  when: string;
  html: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "title-hero-scrim",
    name: "Hero photo with side scrim",
    tags: ["title", "closing", "photo", "landscape"],
    when: "Title slide with a strong landscape photo. Photo fills the canvas; a gradient scrim makes one side calm for the title block; presenter details flow in the same flex container so nothing collides.",
    html: `<style>
.slide .hero{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:70% 50%}
.slide .scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,color-mix(in srgb,var(--bg) 92%,transparent) 42%,transparent 78%)}
.slide .copy{position:absolute;left:80px;top:96px;width:600px;display:flex;flex-direction:column;gap:18px}
.slide .kicker{font-size:18px;letter-spacing:.2em;text-transform:uppercase;color:var(--primary);font-weight:700}
.slide h1{font-family:var(--font-heading);font-size:78px;line-height:1.02;color:var(--ink)}
.slide .sub{font-size:26px;line-height:1.35;color:var(--muted)}
.slide .rule{width:96px;height:6px;border-radius:3px;background:var(--accent)}
.slide .meta{display:grid;grid-template-columns:max-content 1fr;gap:8px 22px;margin-top:10px}
.slide .meta p{font-size:19px;color:var(--muted)}.slide .meta strong{font-size:21px;color:var(--ink)}
</style>
<img class="hero" src="asset:img1" alt="">
<div class="scrim"></div>
<div class="copy">
  <p class="kicker">Seminar · Plant Physiology</p>
  <h1>Photosynthesis</h1>
  <p class="sub">How leaves turn sunlight into sugar</p>
  <div class="rule"></div>
  <div class="meta"><p>Presented by</p><strong>Riya Sen · 23BIO041</strong><p>Guide</p><strong>Dr. A. Mukherjee</strong></div>
</div>`,
  },
  {
    id: "title-diagonal-split",
    name: "Diagonal split with photo panel",
    tags: ["title", "closing", "photo", "portrait", "square"],
    when: "Title or closing slide when the photo is portrait/square. Text on a solid field, photo in a diagonal clip-path panel on the right, an accent stripe along the cut edge.",
    html: `<style>
.slide .panel{position:absolute;right:0;top:0;width:620px;height:720px;object-fit:cover;clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}
.slide .stripe{position:absolute;right:0;top:0;width:640px;height:720px;background:var(--accent);clip-path:polygon(19% 0,22% 0,3% 100%,0 100%)}
.slide .copy{position:absolute;left:80px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:20px}
.slide .tag{align-self:flex-start;font-size:17px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--bg);background:var(--primary);padding:8px 16px;border-radius:999px}
.slide h1{font-family:var(--font-heading);font-size:66px;line-height:1.05;color:var(--ink)}
.slide .sub{font-size:25px;color:var(--muted);line-height:1.35}
.slide .who{display:flex;flex-direction:column;gap:6px;border-left:4px solid var(--accent);padding-left:18px;margin-top:12px}
.slide .who p{font-size:20px;color:var(--ink)}.slide .who span{color:var(--muted)}
</style>
<img class="panel" src="asset:img1" alt="">
<div class="stripe"></div>
<div class="copy">
  <p class="tag">Project Review 1</p>
  <h1>Smart Library Management System</h1>
  <p class="sub">RFID check-in, live seat availability and fine automation</p>
  <div class="who"><p><span>Team:</span> Arjun Das, Mehak Roy</p><p><span>Guide:</span> Prof. S. Banerjee</p><p><span>Dept. of CSE, 5th Semester</span></p></div>
</div>`,
  },
  {
    id: "title-typographic",
    name: "Typographic title, no photo",
    tags: ["title", "closing", "none", "typography"],
    when: "Title slide with no usable photo: a huge outlined word sets the mood, a solid title block sits over it, and presenter details sit in a clean two-column grid at the bottom.",
    html: `<style>
.slide .ghost{position:absolute;right:60px;top:10px;font-family:var(--font-heading);font-size:280px;font-weight:900;line-height:1;color:transparent;-webkit-text-stroke:2px color-mix(in srgb,var(--primary) 35%,transparent);letter-spacing:-.04em}
.slide .band{position:absolute;left:0;right:0;bottom:0;height:200px;background:var(--surface);border-top:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}
.slide .copy{position:absolute;left:80px;top:250px;width:1000px;display:flex;flex-direction:column;gap:14px}
.slide h1{font-family:var(--font-heading);font-size:72px;line-height:1.05;color:var(--ink)}
.slide .sub{font-size:27px;color:var(--primary);font-weight:600}
.slide .meta{position:absolute;left:80px;bottom:52px;width:1120px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.slide .meta div{display:flex;flex-direction:column;gap:6px}
.slide .meta small{font-size:16px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.slide .meta strong{font-size:21px;color:var(--ink)}
</style>
<p class="ghost">DSA</p>
<div class="copy"><h1>Graph Algorithms in Route Planning</h1><p class="sub">From Dijkstra to A* in real navigation apps</p></div>
<div class="band"></div>
<div class="meta">
  <div><small>Presented by</small><strong>Kunal Mehta</strong></div>
  <div><small>Roll no.</small><strong>22CSE118</strong></div>
  <div><small>Guide</small><strong>Dr. P. Roy</strong></div>
  <div><small>Department</small><strong>Computer Science</strong></div>
</div>`,
  },
  {
    id: "title-arch-centered",
    name: "Centered title with arch-masked photo",
    tags: ["title", "closing", "photo", "portrait", "square"],
    when: "Elegant symmetric title: photo inside an arch shape on the right with an offset outline; the title block is vertically centred on the left. Good for humanities, biology, history topics.",
    html: `<style>
.slide .outline{position:absolute;left:822px;top:96px;width:360px;height:540px;border:3px solid var(--accent);border-radius:180px 180px 24px 24px}
.slide .arch{position:absolute;left:796px;top:72px;width:360px;height:540px;object-fit:cover;border-radius:180px 180px 24px 24px}
.slide .dot{position:absolute;left:740px;top:560px;width:90px;height:90px;border-radius:50%;background:var(--primary)}
.slide .copy{position:absolute;left:88px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.slide .kicker{font-size:18px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.slide h1{font-family:var(--font-heading);font-size:70px;line-height:1.05;color:var(--ink)}
.slide h1 em{font-style:normal;color:var(--primary)}
.slide .meta{display:flex;flex-direction:column;gap:6px;margin-top:16px;font-size:21px;color:var(--ink)}
.slide .meta span{color:var(--muted)}
</style>
<div class="outline"></div>
<img class="arch" src="asset:img1" alt="">
<div class="dot"></div>
<div class="copy">
  <p class="kicker">B.Sc Zoology · Semester 3</p>
  <h1>The <em>Mitochondrion</em>: Powerhouse of the Cell</h1>
  <div class="meta"><p><span>By</span> Sneha Paul (21ZOO07)</p><p><span>Guide</span> Dr. R. Ghosh</p></div>
</div>`,
  },
  {
    id: "title-duotone-band",
    name: "Duotone photo band title",
    tags: ["title", "section", "photo", "landscape"],
    when: "Bold title: a full-width duotone photo band (grayscale photo multiplied over the primary colour) across the top 60%, title overlapping the band edge on a solid card.",
    html: `<style>
.slide .band{position:absolute;left:0;top:0;width:1280px;height:430px;background:var(--primary)}
.slide .band img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.15);mix-blend-mode:multiply;opacity:.9}
.slide .card{position:absolute;left:80px;top:300px;width:820px;background:var(--bg);padding:36px 44px;border-radius:6px;box-shadow:0 18px 50px color-mix(in srgb,var(--ink) 18%,transparent);display:flex;flex-direction:column;gap:12px}
.slide h1{font-family:var(--font-heading);font-size:60px;line-height:1.06;color:var(--ink)}
.slide .sub{font-size:24px;color:var(--muted)}
.slide .meta{position:absolute;right:80px;bottom:56px;width:300px;display:flex;flex-direction:column;gap:6px;text-align:right}
.slide .meta p{font-size:20px;color:var(--ink)}.slide .meta small{font-size:16px;color:var(--muted)}
</style>
<div class="band"><img src="asset:img1" alt=""></div>
<div class="card"><h1>Renewable Energy in India</h1><p class="sub">Solar and wind growth, challenges and the road to 2030</p></div>
<div class="meta"><small>Presented by</small><p>Aman Verma</p><small>EEE · 2nd Year</small></div>`,
  },
  {
    id: "agenda-path",
    name: "Numbered vertical path agenda",
    tags: ["agenda", "outline", "none"],
    when: "Agenda as a designed path: big title on the left, sections as numbered nodes joined by a vertical line on the right. Never a plain bullet list.",
    html: `<style>
.slide .left{position:absolute;left:80px;top:96px;width:400px;display:flex;flex-direction:column;gap:18px}
.slide h2{font-family:var(--font-heading);font-size:58px;color:var(--ink);line-height:1.05}
.slide .lead{font-size:24px;color:var(--muted);line-height:1.4}
.slide .line{position:absolute;left:612px;top:110px;width:4px;height:500px;background:color-mix(in srgb,var(--primary) 25%,transparent);border-radius:2px}
.slide .steps{position:absolute;left:584px;top:90px;width:620px;height:540px;list-style:none;padding:0;display:flex;flex-direction:column;justify-content:space-between}
.slide .steps li{display:flex;align-items:center;gap:26px}
.slide .steps b{flex:none;width:60px;height:60px;border-radius:50%;background:var(--primary);color:var(--bg);font-family:var(--font-heading);font-size:24px;display:flex;align-items:center;justify-content:center}
.slide .steps p{font-size:27px;color:var(--ink)}.slide .steps span{display:block;font-size:19px;color:var(--muted);margin-top:2px}
</style>
<div class="left"><h2>Today's Roadmap</h2><p class="lead">Five parts, about twelve minutes.</p></div>
<div class="line"></div>
<ol class="steps">
  <li><b>01</b><p>Introduction<span>What problem we solve</span></p></li>
  <li><b>02</b><p>Existing system<span>Gaps in manual records</span></p></li>
  <li><b>03</b><p>Proposed design<span>Architecture and modules</span></p></li>
  <li><b>04</b><p>Results<span>Testing on 500 records</span></p></li>
  <li><b>05</b><p>Conclusion &amp; future scope</p></li>
</ol>`,
  },
  {
    id: "agenda-cards-row",
    name: "Agenda as a row of tall cards",
    tags: ["agenda", "outline", "none", "summary"],
    when: "Agenda with 3–5 sections as tall cards in one row, each with a large faded number and a short label. Works on dark decks too.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:72px;width:1100px;font-family:var(--font-heading);font-size:54px;color:var(--ink)}
.slide .row{position:absolute;left:80px;top:200px;width:1120px;height:440px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.slide .row div{background:var(--surface);border-radius:20px;padding:30px 26px;display:flex;flex-direction:column;justify-content:space-between;border-top:8px solid var(--primary)}
.slide .row div:nth-child(even){border-top-color:var(--accent)}
.slide .row b{font-family:var(--font-heading);font-size:96px;line-height:1;color:color-mix(in srgb,var(--primary) 22%,transparent)}
.slide .row p{font-size:28px;line-height:1.25;color:var(--ink);font-weight:600}
.slide .row span{display:block;margin-top:8px;font-size:19px;font-weight:400;color:var(--muted)}
</style>
<h2>What we will cover</h2>
<div class="row">
  <div><b>1</b><p>Principle<span>Beer–Lambert law</span></p></div>
  <div><b>2</b><p>Instrument<span>Parts of a spectrophotometer</span></p></div>
  <div><b>3</b><p>Spectra<span>Reading λmax</span></p></div>
  <div><b>4</b><p>Applications<span>Pharma, food, water</span></p></div>
</div>`,
  },
  {
    id: "statement-big",
    name: "Big statement slide",
    tags: ["statement", "section", "concept", "none", "quote"],
    when: "One idea that deserves a full slide: an oversized sentence with one highlighted phrase, a thin accent rule and a small supporting line. Typography is the visual.",
    html: `<style>
.slide .mark{position:absolute;left:64px;top:40px;font-family:var(--font-heading);font-size:260px;line-height:1;color:color-mix(in srgb,var(--accent) 30%,transparent)}
.slide .copy{position:absolute;left:120px;top:0;bottom:0;width:1000px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.slide .big{font-family:var(--font-heading);font-size:60px;line-height:1.15;color:var(--ink)}
.slide .big mark{background:linear-gradient(transparent 62%,color-mix(in srgb,var(--accent) 45%,transparent) 62%);color:inherit}
.slide .rule{width:120px;height:5px;background:var(--primary)}
.slide .small{font-size:24px;color:var(--muted);line-height:1.4;max-width:760px}
</style>
<p class="mark">“</p>
<div class="copy">
  <p class="big">Over <mark>70% of India's drinking water</mark> comes from groundwater, and it is falling every year.<sup>[3]</sup></p>
  <div class="rule"></div>
  <p class="small">That is why rainwater harvesting is not optional for our campus.</p>
</div>`,
  },
  {
    id: "section-numeral",
    name: "Section divider with giant numeral",
    tags: ["section", "statement", "none"],
    when: "Section break inside a long deck: a colour field covers the left third with a giant section number; the section title and a one-line preview sit on the right.",
    html: `<style>
.slide .field{position:absolute;left:0;top:0;width:430px;height:720px;background:var(--primary)}
.slide .num{position:absolute;left:40px;top:150px;width:360px;font-family:var(--font-heading);font-size:320px;line-height:1;color:var(--bg);opacity:.95;text-align:center}
.slide .copy{position:absolute;left:520px;top:0;bottom:0;width:660px;display:flex;flex-direction:column;justify-content:center;gap:20px}
.slide small{font-size:18px;letter-spacing:.24em;text-transform:uppercase;color:var(--primary);font-weight:700}
.slide h2{font-family:var(--font-heading);font-size:64px;line-height:1.05;color:var(--ink)}
.slide p{font-size:26px;color:var(--muted);line-height:1.4}
</style>
<div class="field"></div>
<p class="num">02</p>
<div class="copy"><small>Part two</small><h2>Methodology</h2><p>How we collected and cleaned 1,200 survey responses.</p></div>`,
  },
  {
    id: "concept-definition",
    name: "Definition card with photo strip",
    tags: ["concept", "definition", "photo", "portrait"],
    when: "Introducing a term: the term large, a short phonetic/kicker line, the definition in a calm card, one example line; a tall photo strip on the right edge.",
    html: `<style>
.slide .strip{position:absolute;right:0;top:0;width:380px;height:720px;object-fit:cover}
.slide .copy{position:absolute;left:80px;top:80px;width:700px;display:flex;flex-direction:column;gap:20px}
.slide small{font-size:18px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.slide h2{font-family:var(--font-heading);font-size:64px;color:var(--ink);line-height:1.02}
.slide .def{background:var(--surface);border-left:8px solid var(--primary);border-radius:0 16px 16px 0;padding:26px 30px}
.slide .def p{font-size:28px;line-height:1.38;color:var(--ink)}
.slide .eg{display:flex;gap:16px;align-items:baseline}
.slide .eg b{font-size:19px;color:var(--accent);letter-spacing:.1em;text-transform:uppercase}
.slide .eg p{font-size:24px;color:var(--muted);line-height:1.4}
</style>
<div class="copy">
  <small>Key term</small>
  <h2>Osmosis</h2>
  <div class="def"><p>Movement of water across a semi-permeable membrane from lower to higher solute concentration.<sup>[2]</sup></p></div>
  <div class="eg"><b>Example</b><p>Raisins swell when soaked in water.</p></div>
</div>
<img class="strip" src="asset:img1" alt="">`,
  },
  {
    id: "concept-circle-ring",
    name: "Key concept with circle photo and offset ring",
    tags: ["concept", "photo", "square", "landscape"],
    when: "Explaining one concept with 2–3 points: text column left, photo in a large circle on the right with an offset accent ring and a small floating label chip.",
    html: `<style>
.slide .ring{position:absolute;left:760px;top:120px;width:440px;height:440px;border-radius:50%;border:3px solid var(--accent)}
.slide .circle{position:absolute;left:730px;top:96px;width:440px;height:440px;border-radius:50%;object-fit:cover}
.slide .chip{position:absolute;left:700px;top:500px;background:var(--primary);color:var(--bg);font-size:19px;font-weight:700;padding:10px 18px;border-radius:999px}
.slide .text{position:absolute;left:80px;top:90px;width:580px;display:flex;flex-direction:column;gap:22px}
.slide h2{font-family:var(--font-heading);font-size:54px;color:var(--ink);line-height:1.05}
.slide .key{font-size:29px;color:var(--primary);font-weight:600;line-height:1.3}
.slide ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:14px}
.slide li{position:relative;padding-left:30px;font-size:25px;line-height:1.4;color:var(--ink)}
.slide li::before{content:"";position:absolute;left:0;top:.55em;width:14px;height:3px;background:var(--accent)}
</style>
<div class="text">
  <h2>Chlorophyll</h2>
  <p class="key">The pigment that captures red and blue light.</p>
  <ul><li>Absorbs most strongly near 430 nm and 662 nm<sup>[1]</sup></li><li>Reflects green, which is why leaves look green</li><li>Sits in thylakoid membranes of chloroplasts</li></ul>
</div>
<div class="ring"></div>
<img class="circle" src="asset:img1" alt="">
<p class="chip">Chloroplast, 1000×</p>`,
  },
  {
    id: "concept-annotated",
    name: "Annotated photo with leader lines",
    tags: ["concept", "anatomy", "photo", "landscape", "instrument"],
    when: "Showing the parts of a real object (instrument, specimen, machine): the photo is large; 3–4 labels sit in the margin and thin SVG leader lines point to the parts.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:56px;width:900px;font-family:var(--font-heading);font-size:50px;color:var(--ink)}
.slide .photo{position:absolute;left:300px;top:150px;width:680px;height:500px;object-fit:cover;border-radius:18px}
.slide svg{position:absolute;left:0;top:0;width:1280px;height:720px}
.slide .lab{position:absolute;width:220px;display:flex;flex-direction:column;gap:4px}
.slide .lab strong{font-size:22px;color:var(--ink)}.slide .lab p{font-size:18px;color:var(--muted);line-height:1.3}
.slide .l1{left:64px;top:210px}.slide .l2{left:64px;top:470px}.slide .l3{left:1010px;top:200px}.slide .l4{left:1010px;top:470px}
</style>
<h2>Parts of a compound microscope</h2>
<img class="photo" src="asset:img1" alt="">
<svg viewBox="0 0 1280 720"><g stroke="var(--accent)" stroke-width="2.5" fill="var(--accent)">
<line x1="284" y1="232" x2="430" y2="250"/><circle cx="430" cy="250" r="6"/>
<line x1="284" y1="492" x2="470" y2="520"/><circle cx="470" cy="520" r="6"/>
<line x1="996" y1="222" x2="820" y2="240"/><circle cx="820" cy="240" r="6"/>
<line x1="996" y1="492" x2="800" y2="560"/><circle cx="800" cy="560" r="6"/></g></svg>
<div class="lab l1"><strong>Eyepiece</strong><p>10× magnification</p></div>
<div class="lab l2"><strong>Stage</strong><p>Holds the slide</p></div>
<div class="lab l3"><strong>Objective lenses</strong><p>4×, 10×, 40×, 100×</p></div>
<div class="lab l4"><strong>Fine focus</strong><p>Sharpens the image</p></div>`,
  },
  {
    id: "process-flow-html",
    name: "Horizontal process built with HTML",
    tags: ["process", "method", "steps", "diagram", "none"],
    when: "A 3–5 step process drawn with plain HTML: numbered step cards in a row joined by CSS arrows, a one-line intro above and a takeaway bar below.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:60px;width:1100px;font-family:var(--font-heading);font-size:52px;color:var(--ink)}
.slide .intro{position:absolute;left:80px;top:140px;width:900px;font-size:25px;color:var(--muted)}
.slide .flow{position:absolute;left:80px;top:230px;width:1120px;height:300px;display:flex;align-items:stretch;gap:44px}
.slide .step{flex:1;position:relative;background:var(--surface);border-radius:20px;padding:26px 22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 6px 20px color-mix(in srgb,var(--ink) 8%,transparent)}
.slide .step:not(:last-child)::after{content:"";position:absolute;right:-34px;top:50%;width:22px;height:22px;border-top:4px solid var(--accent);border-right:4px solid var(--accent);transform:translateY(-50%) rotate(45deg)}
.slide .step b{font-family:var(--font-heading);font-size:40px;color:var(--primary)}
.slide .step strong{font-size:25px;color:var(--ink)}.slide .step p{font-size:19px;line-height:1.35;color:var(--muted)}
.slide .take{position:absolute;left:80px;top:580px;width:1120px;background:var(--primary);border-radius:14px;padding:18px 28px}
.slide .take p{font-size:23px;color:var(--bg);font-weight:600}
</style>
<h2>How a request reaches the server</h2>
<p class="intro">Four steps, each under 50 ms on a good connection.</p>
<div class="flow">
  <div class="step"><b>1</b><strong>DNS lookup</strong><p>Domain name becomes an IP address</p></div>
  <div class="step"><b>2</b><strong>TCP handshake</strong><p>Client and server agree to talk</p></div>
  <div class="step"><b>3</b><strong>TLS</strong><p>Keys exchanged, link encrypted</p></div>
  <div class="step"><b>4</b><strong>HTTP request</strong><p>Server returns the page</p></div>
</div>
<div class="take"><p>Caching DNS and reusing connections removes steps 1–3 on repeat visits.</p></div>`,
  },
  {
    id: "process-vertical-photo",
    name: "Vertical numbered steps beside a photo band",
    tags: ["process", "method", "steps", "photo", "portrait"],
    when: "Steps that happen in a lab or field: a full-height photo band on the left, numbered steps stacked on the right with a thin connector line.",
    html: `<style>
.slide .band{position:absolute;left:0;top:0;width:420px;height:720px;object-fit:cover}
.slide .tint{position:absolute;left:0;top:0;width:420px;height:720px;background:linear-gradient(180deg,transparent 55%,color-mix(in srgb,var(--primary) 70%,transparent))}
.slide .cap{position:absolute;left:40px;bottom:40px;width:340px;font-size:19px;color:#fff}
.slide .copy{position:absolute;left:500px;top:64px;width:700px;display:flex;flex-direction:column;gap:26px}
.slide h2{font-family:var(--font-heading);font-size:50px;color:var(--ink)}
.slide ol{list-style:none;padding:0;display:flex;flex-direction:column;gap:20px;position:relative}
.slide ol::before{content:"";position:absolute;left:23px;top:20px;bottom:20px;width:2px;background:color-mix(in srgb,var(--primary) 30%,transparent)}
.slide li{display:flex;gap:22px;align-items:flex-start;position:relative}
.slide li b{flex:none;width:48px;height:48px;border-radius:50%;background:var(--bg);border:3px solid var(--primary);color:var(--primary);font-size:21px;display:flex;align-items:center;justify-content:center}
.slide li p{font-size:24px;line-height:1.35;color:var(--ink);padding-top:8px}
</style>
<img class="band" src="asset:img1" alt="">
<div class="tint"></div>
<p class="cap">Titration setup in the analytical lab</p>
<div class="copy">
  <h2>Acid–base titration</h2>
  <ol><li><b>1</b><p>Fill the burette with standard NaOH</p></li><li><b>2</b><p>Add 2 drops of phenolphthalein to the acid</p></li><li><b>3</b><p>Titrate until a faint pink colour persists</p></li><li><b>4</b><p>Record the volume and calculate molarity</p></li></ol>
</div>`,
  },
  {
    id: "process-cycle-component",
    name: "Cycle drawn with HTML and SVG arcs",
    tags: ["process", "cycle", "diagram", "none"],
    when: "A repeating cycle (life cycle, water cycle, PDCA): the engine's cycle diagram fills a big square on the right; the left column explains why the cycle matters.",
    html: `<style>
.slide .text{position:absolute;left:80px;top:100px;width:470px;display:flex;flex-direction:column;gap:22px}
.slide h2{font-family:var(--font-heading);font-size:54px;color:var(--ink);line-height:1.05}
.slide .key{font-size:28px;color:var(--primary);font-weight:600;line-height:1.3}
.slide .note{font-size:23px;color:var(--muted);line-height:1.4}
.slide svg{position:absolute;left:640px;top:80px;width:560px;height:560px}
.slide .node{position:absolute;width:230px;background:var(--surface);border-radius:18px;padding:16px 20px;text-align:center;box-shadow:0 8px 22px color-mix(in srgb,var(--ink) 12%,transparent);border-top:6px solid var(--primary)}
.slide .node strong{display:block;font-size:24px;color:var(--ink)}.slide .node span{font-size:18px;color:var(--muted)}
.slide .center{position:absolute;left:835px;top:320px;width:170px;text-align:center;font-family:var(--font-heading);font-size:26px;color:var(--primary);line-height:1.15}
</style>
<div class="text"><h2>The Calvin cycle</h2><p class="key">Three stages repeat to fix CO₂ into sugar.</p><p class="note">Runs in the stroma and uses the ATP and NADPH made by the light reactions.<sup>[4]</sup></p></div>
<svg viewBox="0 0 560 560"><defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker></defs>
<circle cx="280" cy="290" r="200" fill="none" stroke="color-mix(in srgb,var(--primary) 18%,transparent)" stroke-width="2"/>
<g fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#ah)"><path d="M380 120 A200 200 0 0 1 470 330"/><path d="M400 450 A200 200 0 0 1 160 450"/><path d="M90 330 A200 200 0 0 1 180 120"/></g></svg>
<div class="center">Calvin cycle</div>
<div class="node" style="left:805px;top:70px"><strong>Fixation</strong><span>RuBisCO adds CO₂</span></div>
<div class="node" style="left:970px;top:440px"><strong>Reduction</strong><span>ATP + NADPH used</span></div>
<div class="node" style="left:640px;top:440px"><strong>Regeneration</strong><span>RuBP is rebuilt</span></div>`,
  },
  {
    id: "compare-vs",
    name: "Two-sided comparison with VS badge",
    tags: ["comparison", "compare", "none", "photo"],
    when: "Comparing two things: two equal columns on contrasting tints, a round VS badge on the divider, 3 matched rows per side so the eye compares across.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:52px;width:1120px;font-family:var(--font-heading);font-size:50px;color:var(--ink);text-align:center}
.slide .col{position:absolute;top:150px;width:540px;height:500px;border-radius:24px;padding:36px 40px;display:flex;flex-direction:column;gap:22px}
.slide .a{left:80px;background:color-mix(in srgb,var(--primary) 10%,var(--bg))}
.slide .b{left:660px;background:color-mix(in srgb,var(--accent) 14%,var(--bg))}
.slide .col h3{font-family:var(--font-heading);font-size:36px;color:var(--ink)}
.slide .col ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:18px}
.slide .col li{font-size:24px;line-height:1.35;color:var(--ink);padding-bottom:16px;border-bottom:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}
.slide .vs{position:absolute;left:592px;top:350px;width:96px;height:96px;border-radius:50%;background:var(--ink);color:var(--bg);font-family:var(--font-heading);font-size:30px;display:flex;align-items:center;justify-content:center;border:6px solid var(--bg)}
</style>
<h2>Mitosis vs Meiosis</h2>
<div class="col a"><h3>Mitosis</h3><ul><li>One division, two cells</li><li>Daughter cells identical (2n)</li><li>Growth and repair</li></ul></div>
<div class="col b"><h3>Meiosis</h3><ul><li>Two divisions, four cells</li><li>Daughter cells haploid (n)</li><li>Gametes for reproduction</li></ul></div>
<p class="vs">VS</p>`,
  },
  {
    id: "compare-table",
    name: "Criteria comparison table",
    tags: ["comparison", "compare", "table", "data", "none"],
    when: "Comparing 2–3 options on 4–5 criteria: a real HTML table with a highlighted recommended column, generous row height and short cell text.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:56px;width:1100px;font-family:var(--font-heading);font-size:50px;color:var(--ink)}
.slide table{position:absolute;left:80px;top:160px;width:1120px;border-collapse:separate;border-spacing:0}
.slide th{font-size:22px;color:var(--muted);text-align:left;padding:14px 22px;font-weight:600}
.slide th.pick{color:var(--bg);background:var(--primary);border-radius:14px 14px 0 0}
.slide td{font-size:23px;color:var(--ink);padding:18px 22px;border-top:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}
.slide td:first-child{color:var(--muted);font-weight:600}
.slide td.pick{background:color-mix(in srgb,var(--primary) 10%,transparent);font-weight:600}
</style>
<h2>Choosing a database for the library app</h2>
<table>
  <tr><th>Criterion</th><th>MySQL</th><th class="pick">PostgreSQL</th><th>MongoDB</th></tr>
  <tr><td>Data model</td><td>Relational</td><td class="pick">Relational + JSON</td><td>Documents</td></tr>
  <tr><td>Transactions</td><td>Yes</td><td class="pick">Yes, strict</td><td>Limited</td></tr>
  <tr><td>Full-text search</td><td>Basic</td><td class="pick">Built in</td><td>Built in</td></tr>
  <tr><td>Hosting cost</td><td>Free tiers</td><td class="pick">Free tiers</td><td>Free tier</td></tr>
</table>`,
  },
  {
    id: "compare-proscons",
    name: "Advantages and limitations split",
    tags: ["comparison", "advantages", "limitations", "none"],
    when: "Pros vs cons: the slide is split into two colour fields edge to edge; each side has a header word and 3 short points with simple drawn check / cross marks.",
    html: `<style>
.slide .l{position:absolute;left:0;top:0;width:640px;height:720px;background:color-mix(in srgb,var(--primary) 12%,var(--bg))}
.slide .r{position:absolute;left:640px;top:0;width:640px;height:720px;background:var(--surface)}
.slide .side{position:absolute;top:90px;width:480px;display:flex;flex-direction:column;gap:26px}
.slide .s1{left:80px}.slide .s2{left:720px}
.slide h3{font-family:var(--font-heading);font-size:46px;color:var(--ink)}
.slide ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:22px}
.slide li{display:flex;gap:18px;align-items:flex-start;font-size:25px;line-height:1.35;color:var(--ink)}
.slide li i{flex:none;width:34px;height:34px;border-radius:50%;margin-top:2px}
.slide .s1 i{background:var(--primary)}.slide .s2 i{background:var(--accent)}
.slide .s1 i::after{content:"";display:block;width:9px;height:16px;margin:6px 0 0 12px;border:solid var(--bg);border-width:0 4px 4px 0;transform:rotate(45deg)}
.slide .s2 i::after{content:"";display:block;width:18px;height:4px;margin:15px 0 0 8px;background:var(--bg)}
</style>
<div class="l"></div><div class="r"></div>
<div class="side s1"><h3>Advantages</h3><ul><li><i></i>No moving parts, low maintenance</li><li><i></i>Zero emissions while running</li><li><i></i>Panels last 25+ years<sup>[2]</sup></li></ul></div>
<div class="side s2"><h3>Limitations</h3><ul><li><i></i>Output drops on cloudy days</li><li><i></i>Needs storage for night use</li><li><i></i>High upfront cost</li></ul></div>`,
  },
  {
    id: "data-big-number",
    name: "Hero statistic",
    tags: ["data", "stat", "statistic", "number", "none", "photo"],
    when: "One striking, sourced number: the number fills a third of the slide, a short label explains it, a context sentence and the citation sit beneath; optional faint photo on the far side.",
    html: `<style>
.slide .bgimg{position:absolute;right:0;top:0;width:520px;height:720px;object-fit:cover;opacity:.9}
.slide .fade{position:absolute;right:0;top:0;width:560px;height:720px;background:linear-gradient(90deg,var(--bg),transparent 45%)}
.slide .copy{position:absolute;left:80px;top:0;bottom:0;width:700px;display:flex;flex-direction:column;justify-content:center;gap:14px}
.slide small{font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.slide .num{font-family:var(--font-heading);font-size:190px;line-height:.95;color:var(--primary);letter-spacing:-.03em}
.slide .num span{font-size:90px}
.slide .label{font-size:34px;color:var(--ink);font-weight:600;line-height:1.2}
.slide .ctx{font-size:24px;color:var(--muted);line-height:1.4;max-width:620px}
</style>
<img class="bgimg" src="asset:img1" alt=""><div class="fade"></div>
<div class="copy"><small>Global e-waste, 2022</small><p class="num">62<span>Mt</span></p><p class="label">of electronic waste generated in one year</p><p class="ctx">Only about a fifth of it was formally collected and recycled.<sup>[1]</sup></p></div>`,
  },
  {
    id: "data-bars",
    name: "Bar chart with insight callout",
    tags: ["data", "chart", "statistic", "numbers"],
    when: "Comparing a few sourced numbers: the engine's bar chart takes 60% of the slide; a side panel states the one insight the chart proves. Only numbers from the sources.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:56px;width:1100px;font-family:var(--font-heading);font-size:48px;color:var(--ink)}
.slide .insight{position:absolute;left:880px;top:180px;width:320px;display:flex;flex-direction:column;gap:16px;border-top:6px solid var(--accent);padding-top:22px}
.slide .insight strong{font-size:30px;line-height:1.25;color:var(--ink)}
.slide .insight p{font-size:21px;color:var(--muted);line-height:1.4}
</style>
<h2>Installed solar capacity in India (GW)</h2>
<figure class="v3-diagram" data-kind="bars" style="position:absolute;left:80px;top:160px;width:740px;height:470px">
  <li data-value="2.6">2014</li><li data-value="12.3">2016</li><li data-value="28.2">2018</li><li data-value="39.1">2020</li><li data-value="63.3">2022</li>
</figure>
<div class="insight"><strong>24× growth in eight years</strong><p>Driven by solar parks and falling module prices.<sup>[2]</sup></p></div>`,
  },
  {
    id: "data-stat-trio",
    name: "Three statistics with rules",
    tags: ["data", "stat", "statistic", "numbers", "summary", "none"],
    when: "Three related sourced numbers side by side, each with a large figure, a thin top rule in a different accent and a two-line label; one framing sentence above.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:70px;width:1100px;font-family:var(--font-heading);font-size:52px;color:var(--ink)}
.slide .lead{position:absolute;left:80px;top:150px;width:900px;font-size:25px;color:var(--muted)}
.slide .trio{position:absolute;left:80px;top:270px;width:1120px;display:grid;grid-template-columns:repeat(3,1fr);gap:48px}
.slide .trio div{border-top:6px solid var(--primary);padding-top:26px;display:flex;flex-direction:column;gap:10px}
.slide .trio div:nth-child(2){border-color:var(--accent)}.slide .trio div:nth-child(3){border-color:var(--accent2)}
.slide .trio b{font-family:var(--font-heading);font-size:92px;line-height:1;color:var(--ink)}
.slide .trio p{font-size:23px;line-height:1.35;color:var(--muted)}
</style>
<h2>Antibiotic resistance at a glance</h2>
<p class="lead">Figures from the WHO global surveillance report.<sup>[1]</sup></p>
<div class="trio"><div><b>1.27M</b><p>deaths directly caused by resistant bacteria in 2019</p></div><div><b>1 in 6</b><p>lab-confirmed infections resistant to standard drugs</p></div><div><b>2050</b><p>year by which deaths could exceed cancer, at current trends</p></div></div>`,
  },
  {
    id: "timeline-horizontal",
    name: "Horizontal timeline",
    tags: ["timeline", "history", "milestones", "none"],
    when: "History or milestones: a horizontal axis across the middle, years above, events below, alternating so labels never collide; the latest milestone in the accent colour.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:60px;width:1100px;font-family:var(--font-heading);font-size:52px;color:var(--ink)}
.slide .axis{position:absolute;left:80px;top:380px;width:1120px;height:4px;background:color-mix(in srgb,var(--ink) 20%,transparent)}
.slide .ev{position:absolute;width:240px;display:flex;flex-direction:column;gap:8px}
.slide .ev::before{content:"";position:absolute;left:0;width:20px;height:20px;border-radius:50%;background:var(--primary);border:4px solid var(--bg)}
.slide .up{bottom:340px;padding-bottom:30px}.slide .up::before{bottom:-12px}
.slide .down{top:380px;padding-top:32px}.slide .down::before{top:-8px}
.slide .ev b{font-family:var(--font-heading);font-size:40px;color:var(--primary)}
.slide .ev p{font-size:21px;line-height:1.35;color:var(--ink)}
.slide .last b{color:var(--accent)}.slide .last::before{background:var(--accent)}
</style>
<h2>Milestones of the Internet</h2>
<div class="axis"></div>
<div class="ev up" style="left:80px"><b>1969</b><p>ARPANET sends its first message</p></div>
<div class="ev down" style="left:360px"><b>1983</b><p>TCP/IP becomes the standard</p></div>
<div class="ev up" style="left:640px"><b>1991</b><p>World Wide Web goes public</p></div>
<div class="ev down last" style="left:920px"><b>2007</b><p>Smartphones put the web in every pocket</p></div>`,
  },
  {
    id: "timeline-vertical-photo",
    name: "Vertical timeline with portrait photo",
    tags: ["timeline", "history", "biography", "photo", "portrait"],
    when: "A person's or discovery's story: portrait photo on the left in a soft-shadow print frame with caption; a vertical timeline of 3–4 dated events on the right.",
    html: `<style>
.slide .frame{position:absolute;left:80px;top:90px;width:360px;height:470px;background:#fff;padding:14px;box-shadow:0 14px 40px color-mix(in srgb,var(--ink) 18%,transparent);transform:rotate(-2deg)}
.slide .frame img{width:100%;height:100%;object-fit:cover}
.slide .cap{position:absolute;left:80px;top:590px;width:380px;font-size:19px;color:var(--muted)}
.slide .copy{position:absolute;left:540px;top:70px;width:660px;display:flex;flex-direction:column;gap:22px}
.slide h2{font-family:var(--font-heading);font-size:50px;color:var(--ink)}
.slide ul{list-style:none;padding:0 0 0 30px;border-left:3px solid var(--primary);display:flex;flex-direction:column;gap:22px}
.slide li{position:relative}.slide li::before{content:"";position:absolute;left:-41px;top:8px;width:16px;height:16px;border-radius:50%;background:var(--accent);border:3px solid var(--bg)}
.slide li b{font-size:24px;color:var(--primary)}.slide li p{font-size:23px;line-height:1.35;color:var(--ink)}
</style>
<div class="frame"><img src="asset:img1" alt=""></div>
<p class="cap">C. V. Raman, Nobel Prize in Physics 1930</p>
<div class="copy"><h2>The Raman effect</h2><ul><li><b>1921</b><p>Voyage to Europe sparks his question about the blue sea</p></li><li><b>1928</b><p>Discovers inelastic scattering of light<sup>[1]</sup></p></li><li><b>1930</b><p>First Asian Nobel laureate in science</p></li></ul></div>`,
  },
  {
    id: "quote-portrait",
    name: "Quote with circular portrait",
    tags: ["quote", "person", "photo", "statement"],
    when: "A short, attributable quote from a real person in the sources: quote large and centred-left, portrait in a circle, name and role beneath it.",
    html: `<style>
.slide .q{position:absolute;left:80px;top:0;bottom:0;width:760px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.slide blockquote{font-family:var(--font-heading);font-size:46px;line-height:1.25;color:var(--ink);border-left:8px solid var(--accent);padding-left:36px}
.slide .who{padding-left:44px;display:flex;flex-direction:column;gap:4px}
.slide .who strong{font-size:25px;color:var(--ink)}.slide .who span{font-size:20px;color:var(--muted)}
.slide .pic{position:absolute;left:900px;top:200px;width:300px;height:300px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 12px var(--bg),0 0 0 15px var(--primary)}
</style>
<div class="q"><blockquote>Science is a way of thinking much more than it is a body of knowledge.</blockquote><div class="who"><strong>Carl Sagan</strong><span>Astronomer, author of Cosmos</span></div></div>
<img class="pic" src="asset:img1" alt="">`,
  },
  {
    id: "image-fullbleed-card",
    name: "Full-bleed photo with caption card",
    tags: ["image", "photo", "place", "case", "landscape", "concept"],
    when: "When the photo IS the content (a place, an organism, a structure): the photo covers the slide; a solid card in one corner carries the title, one key line and 2 short facts.",
    html: `<style>
.slide .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.slide .shade{position:absolute;inset:0;background:linear-gradient(0deg,color-mix(in srgb,#000 45%,transparent),transparent 50%)}
.slide .card{position:absolute;left:72px;bottom:64px;width:560px;background:var(--bg);border-radius:20px;padding:32px 36px;display:flex;flex-direction:column;gap:14px}
.slide h2{font-family:var(--font-heading);font-size:46px;line-height:1.05;color:var(--ink)}
.slide .key{font-size:24px;color:var(--primary);font-weight:600;line-height:1.3}
.slide .facts{display:flex;gap:28px}.slide .facts p{font-size:19px;color:var(--muted)}.slide .facts strong{display:block;font-size:26px;color:var(--ink)}
</style>
<img class="bg" src="asset:img1" alt=""><div class="shade"></div>
<div class="card"><h2>Sundarbans Mangroves</h2><p class="key">The world's largest mangrove forest protects the coast from cyclones.</p><div class="facts"><p><strong>10,000 km²</strong>area</p><p><strong>UNESCO</strong>World Heritage</p></div></div>`,
  },
  {
    id: "image-mosaic",
    name: "Photo mosaic with captions",
    tags: ["image", "examples", "applications", "photo", "gallery"],
    when: "Showing several real examples: an asymmetric mosaic of 2–3 photos (one large, two small) with short captions, title in the remaining space.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:64px;width:400px;font-family:var(--font-heading);font-size:50px;line-height:1.05;color:var(--ink)}
.slide .lead{position:absolute;left:80px;top:250px;width:380px;font-size:24px;line-height:1.4;color:var(--muted)}
.slide figure{position:absolute;margin:0;overflow:hidden;border-radius:16px}
.slide figure img{width:100%;height:100%;object-fit:cover}
.slide figcaption{position:absolute;left:0;right:0;bottom:0;padding:12px 18px;font-size:19px;color:#fff;background:linear-gradient(0deg,rgba(0,0,0,.65),transparent)}
.slide .f1{left:520px;top:64px;width:420px;height:592px}.slide .f2{left:960px;top:64px;width:260px;height:286px}.slide .f3{left:960px;top:370px;width:260px;height:286px}
</style>
<h2>Where we see it every day</h2><p class="lead">Three applications of the Bernoulli principle.</p>
<figure class="f1"><img src="asset:img1" alt=""><figcaption>Aircraft wing lift</figcaption></figure>
<figure class="f2"><img src="asset:img2" alt=""><figcaption>Carburettor</figcaption></figure>
<figure class="f3"><img src="asset:img3" alt=""><figcaption>Spray bottle</figcaption></figure>`,
  },
  {
    id: "image-cinema-band",
    name: "Cinematic band crop",
    tags: ["image", "photo", "concept", "landscape", "statement"],
    when: "A wide panorama crop runs across the middle as a cinematic band; the title sits above it and a two-column explanation below — calm and editorial.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:52px;width:1120px;font-family:var(--font-heading);font-size:50px;color:var(--ink)}
.slide .band{position:absolute;left:0;top:150px;width:1280px;height:290px;object-fit:cover;object-position:50% 45%}
.slide .cols{position:absolute;left:80px;top:480px;width:1120px;display:grid;grid-template-columns:1fr 1fr;gap:56px}
.slide .cols p{font-size:24px;line-height:1.4;color:var(--ink)}
.slide .cols strong{display:block;font-size:19px;letter-spacing:.14em;text-transform:uppercase;color:var(--primary);margin-bottom:6px}
</style>
<h2>Plate tectonics shaped the Himalaya</h2>
<img class="band" src="asset:img1" alt="">
<div class="cols"><p><strong>Collision</strong>The Indian plate met Eurasia about 50 million years ago.<sup>[1]</sup></p><p><strong>Still rising</strong>The range grows a few millimetres every year as the plates keep pushing.</p></div>`,
  },
  {
    id: "system-layers",
    name: "Layered architecture",
    tags: ["architecture", "system", "layers", "design", "diagram", "none"],
    when: "Software/system architecture: the engine's layers diagram on the right; on the left the title and what each layer is responsible for, in one sentence.",
    html: `<style>
.slide .text{position:absolute;left:80px;top:90px;width:430px;display:flex;flex-direction:column;gap:22px}
.slide h2{font-family:var(--font-heading);font-size:52px;color:var(--ink);line-height:1.05}
.slide .key{font-size:27px;color:var(--primary);font-weight:600;line-height:1.3}
.slide .note{font-size:22px;color:var(--muted);line-height:1.4}
.slide .stack{position:absolute;left:590px;top:90px;width:610px;height:540px;display:flex;flex-direction:column;gap:18px}
.slide .layer{flex:1;border-radius:18px;padding:22px 28px;display:flex;flex-direction:column;justify-content:center;gap:6px;position:relative}
.slide .layer strong{font-size:28px}.slide .layer p{font-size:21px;line-height:1.35}
.slide .l1{background:var(--primary);color:var(--bg)}.slide .l2{background:color-mix(in srgb,var(--primary) 55%,var(--bg));color:var(--bg)}.slide .l3{background:color-mix(in srgb,var(--primary) 16%,var(--bg));color:var(--ink)}
.slide .layer:not(:last-child)::after{content:"";position:absolute;left:50%;bottom:-17px;width:0;height:0;border:10px solid transparent;border-top-color:var(--accent);transform:translateX(-50%)}
</style>
<div class="text"><h2>System architecture</h2><p class="key">Three layers, each replaceable on its own.</p><p class="note">The mobile app never talks to the database directly; every request goes through the API.</p></div>
<div class="stack">
  <div class="layer l1"><strong>Presentation</strong><p>React Native app and the librarian's web panel</p></div>
  <div class="layer l2"><strong>Application</strong><p>REST API, login, fine calculation</p></div>
  <div class="layer l3"><strong>Data</strong><p>PostgreSQL database and RFID event log</p></div>
</div>`,
  },
  {
    id: "system-hub",
    name: "Hub and spokes built with HTML",
    tags: ["architecture", "hub", "system", "concept", "features", "none"],
    when: "One central idea with 4–6 related parts: a central circle with the main term, satellite cards around it, connectors drawn with SVG lines underneath.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:48px;width:1120px;font-family:var(--font-heading);font-size:48px;color:var(--ink);text-align:center}
.slide svg{position:absolute;left:0;top:0;width:1280px;height:720px}
.slide .core{position:absolute;left:520px;top:300px;width:240px;height:240px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
.slide .core p{font-family:var(--font-heading);font-size:30px;color:var(--bg);line-height:1.15}
.slide .sat{position:absolute;width:300px;background:var(--surface);border-radius:16px;padding:18px 22px;box-shadow:0 6px 18px color-mix(in srgb,var(--ink) 10%,transparent)}
.slide .sat strong{display:block;font-size:23px;color:var(--ink)}.slide .sat span{font-size:18px;color:var(--muted)}
</style>
<h2>Components of IoT</h2>
<svg viewBox="0 0 1280 720"><g stroke="color-mix(in srgb,var(--primary) 40%,transparent)" stroke-width="3"><line x1="640" y1="420" x2="290" y2="210"/><line x1="640" y1="420" x2="990" y2="210"/><line x1="640" y1="420" x2="290" y2="600"/><line x1="640" y1="420" x2="990" y2="600"/></g></svg>
<div class="core"><p>Internet of Things</p></div>
<div class="sat" style="left:120px;top:160px"><strong>Sensors</strong><span>Collect temperature, motion</span></div>
<div class="sat" style="left:860px;top:160px"><strong>Connectivity</strong><span>Wi-Fi, LoRa, 5G</span></div>
<div class="sat" style="left:120px;top:560px"><strong>Cloud</strong><span>Stores and analyses data</span></div>
<div class="sat" style="left:860px;top:560px"><strong>Apps</strong><span>Dashboards and alerts</span></div>`,
  },
  {
    id: "formula-spotlight",
    name: "Equation spotlight",
    tags: ["formula", "equation", "law", "principle", "concept", "none"],
    when: "A law or formula: the equation is the hero in a large centred panel; a legend explains each symbol; one line says when it applies.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:60px;width:1120px;font-family:var(--font-heading);font-size:50px;color:var(--ink)}
.slide .eq{position:absolute;left:80px;top:160px;width:1120px;height:200px;background:var(--surface);border-radius:24px;display:flex;align-items:center;justify-content:center}
.slide .eq p{font-family:var(--font-heading);font-size:96px;color:var(--ink);letter-spacing:.02em}
.slide .eq em{color:var(--primary);font-style:italic}
.slide .legend{position:absolute;left:80px;top:410px;width:1120px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.slide .legend div{display:flex;flex-direction:column;gap:6px;border-left:4px solid var(--accent);padding-left:16px}
.slide .legend b{font-size:34px;color:var(--primary);font-style:italic}.slide .legend p{font-size:20px;color:var(--muted);line-height:1.3}
.slide .when{position:absolute;left:80px;top:600px;width:1120px;font-size:22px;color:var(--ink)}
</style>
<h2>Beer–Lambert law</h2>
<div class="eq"><p><em>A</em> = <em>ε</em> · <em>l</em> · <em>c</em></p></div>
<div class="legend"><div><b>A</b><p>Absorbance (no unit)</p></div><div><b>ε</b><p>Molar absorptivity, L mol⁻¹ cm⁻¹</p></div><div><b>l</b><p>Path length, cm</p></div><div><b>c</b><p>Concentration, mol L⁻¹</p></div></div>
<p class="when">Holds for dilute solutions and monochromatic light.<sup>[2]</sup></p>`,
  },
  {
    id: "applications-cards",
    name: "Applications as illustrated cards",
    tags: ["applications", "examples", "features", "case", "none"],
    when: "3 applications or features as cards, each with a simple meaningful line-icon drawn in SVG (only if it clearly depicts the idea), a title and one line.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:64px;width:1100px;font-family:var(--font-heading);font-size:52px;color:var(--ink)}
.slide .cards{position:absolute;left:80px;top:190px;width:1120px;height:430px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.slide .card{background:var(--surface);border-radius:22px;padding:34px 30px;display:flex;flex-direction:column;gap:16px}
.slide .card svg{width:72px;height:72px}
.slide .card strong{font-size:28px;color:var(--ink)}.slide .card p{font-size:21px;line-height:1.4;color:var(--muted)}
</style>
<h2>Applications of UV–Vis spectroscopy</h2>
<div class="cards">
  <div class="card"><svg viewBox="0 0 72 72" fill="none" stroke="var(--primary)" stroke-width="4"><rect x="22" y="8" width="28" height="56" rx="6"/><line x1="22" y1="40" x2="50" y2="40"/></svg><strong>Drug purity</strong><p>Checking tablet concentration in pharma QC</p></div>
  <div class="card"><svg viewBox="0 0 72 72" fill="none" stroke="var(--primary)" stroke-width="4"><path d="M36 8 C24 26 16 36 16 46 a20 20 0 0 0 40 0 C56 36 48 26 36 8z"/></svg><strong>Water testing</strong><p>Nitrate and iron levels in drinking water</p></div>
  <div class="card"><svg viewBox="0 0 72 72" fill="none" stroke="var(--primary)" stroke-width="4"><circle cx="36" cy="36" r="24"/><path d="M24 38 l8 8 l16 -18"/></svg><strong>Food colour</strong><p>Verifying permitted dyes in packaged food</p></div>
</div>`,
  },
  {
    id: "summary-takeaways",
    name: "Key takeaways numbered",
    tags: ["summary", "conclusion", "takeaways", "none"],
    when: "Conclusion: 3–4 numbered takeaways in a 2×2 grid with large numerals; a one-line closing thought spans the bottom on an accent bar.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:60px;width:1100px;font-family:var(--font-heading);font-size:54px;color:var(--ink)}
.slide .grid{position:absolute;left:80px;top:170px;width:1120px;height:380px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:26px 48px}
.slide .grid div{display:flex;gap:22px;align-items:flex-start;border-top:2px solid color-mix(in srgb,var(--ink) 12%,transparent);padding-top:20px}
.slide .grid b{font-family:var(--font-heading);font-size:54px;line-height:1;color:var(--primary)}
.slide .grid p{font-size:25px;line-height:1.35;color:var(--ink)}
.slide .bar{position:absolute;left:80px;top:590px;width:1120px;background:color-mix(in srgb,var(--accent) 18%,var(--bg));border-left:8px solid var(--accent);padding:18px 26px;border-radius:0 12px 12px 0}
.slide .bar p{font-size:24px;color:var(--ink);font-weight:600}
</style>
<h2>Key takeaways</h2>
<div class="grid"><div><b>1</b><p>RFID cuts check-out time from minutes to seconds</p></div><div><b>2</b><p>Live seat data spreads students across floors</p></div><div><b>3</b><p>Automatic fines removed manual errors</p></div><div><b>4</b><p>Built entirely on free, open-source tools</p></div></div>
<div class="bar"><p>Next: pilot in the central library in the even semester.</p></div>`,
  },
  {
    id: "summary-photo-checklist",
    name: "Summary checklist with photo",
    tags: ["summary", "conclusion", "photo", "landscape", "square"],
    when: "Conclusion with a photo: a photo fills the right half with a soft angled edge; a checklist of 3–4 short conclusions on the left.",
    html: `<style>
.slide .ph{position:absolute;right:0;top:0;width:600px;height:720px;object-fit:cover;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%)}
.slide .copy{position:absolute;left:80px;top:90px;width:560px;display:flex;flex-direction:column;gap:28px}
.slide h2{font-family:var(--font-heading);font-size:54px;color:var(--ink)}
.slide ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:20px}
.slide li{display:flex;gap:18px;font-size:25px;line-height:1.35;color:var(--ink)}
.slide li::before{content:"";flex:none;width:12px;height:22px;margin:4px 6px 0 6px;border:solid var(--primary);border-width:0 5px 5px 0;transform:rotate(45deg)}
</style>
<img class="ph" src="asset:img1" alt="">
<div class="copy"><h2>Conclusion</h2><ul><li>Photosynthesis feeds almost every food chain</li><li>Light reactions make ATP and NADPH</li><li>The Calvin cycle uses them to fix CO₂</li></ul></div>`,
  },
  {
    id: "closing-echo",
    name: "Thank-you slide echoing the title",
    tags: ["closing", "thanks", "photo"],
    when: "Closing: echoes the title slide's photo treatment, a large 'Thank you', a one-line recap of the core idea and the presenter names; an invitation for questions in small caps.",
    html: `<style>
.slide .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.9)}
.slide .veil{position:absolute;inset:0;background:color-mix(in srgb,var(--ink) 62%,transparent)}
.slide .copy{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center}
.slide h2{font-family:var(--font-heading);font-size:110px;line-height:1;color:#fff}
.slide .recap{font-size:27px;color:#fff;opacity:.92;width:820px;line-height:1.35}
.slide .rule{width:80px;height:5px;background:var(--accent)}
.slide small{font-size:18px;letter-spacing:.22em;text-transform:uppercase;color:#fff;opacity:.85}
</style>
<img class="bg" src="asset:img1" alt=""><div class="veil"></div>
<div class="copy"><h2>Thank you</h2><p class="recap">Small changes in water use on campus add up to lakhs of litres a year.</p><div class="rule"></div><small>Questions welcome · Riya Sen &amp; Arjun Das</small></div>`,
  },
  {
    id: "closing-typographic",
    name: "Questions slide, typographic",
    tags: ["closing", "thanks", "questions", "none"],
    when: "Closing without a photo: a huge outlined question word as texture, a solid 'Thank you' block, presenter and contact details in a neat row.",
    html: `<style>
.slide .tex{position:absolute;right:60px;top:20px;font-family:var(--font-heading);font-size:420px;font-weight:900;line-height:1;color:transparent;-webkit-text-stroke:3px color-mix(in srgb,var(--primary) 28%,transparent)}
.slide .copy{position:absolute;left:80px;top:180px;width:700px;display:flex;flex-direction:column;gap:18px}
.slide h2{font-family:var(--font-heading);font-size:96px;line-height:1;color:var(--ink)}
.slide p{font-size:28px;color:var(--muted)}
.slide .row{position:absolute;left:80px;bottom:72px;width:1120px;display:flex;gap:64px;border-top:2px solid color-mix(in srgb,var(--ink) 12%,transparent);padding-top:22px}
.slide .row small{display:block;font-size:16px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.slide .row strong{font-size:22px;color:var(--ink)}
</style>
<p class="tex">?</p>
<div class="copy"><h2>Thank you</h2><p>Happy to take your questions.</p></div>
<div class="row"><div><small>Presented by</small><strong>Kunal Mehta</strong></div><div><small>Guide</small><strong>Dr. P. Roy</strong></div><div><small>Department</small><strong>CSE, 5th Semester</strong></div></div>`,
  },
  {
    id: "code-explained",
    name: "Code snippet with explanation",
    tags: ["code", "algorithm", "programming", "implementation", "none"],
    when: "CS slides: a dark code panel (monospace, real syntax colours via spans, ≤ 12 lines, ≥ 20px) on the right; on the left what the code does and its complexity.",
    html: `<style>
.slide .text{position:absolute;left:80px;top:90px;width:430px;display:flex;flex-direction:column;gap:22px}
.slide h2{font-family:var(--font-heading);font-size:50px;color:var(--ink);line-height:1.05}
.slide .key{font-size:26px;color:var(--primary);font-weight:600;line-height:1.3}
.slide .cx{display:flex;gap:28px}.slide .cx p{font-size:19px;color:var(--muted)}.slide .cx strong{display:block;font-size:30px;color:var(--ink);font-family:var(--font-heading)}
.slide .code{position:absolute;left:580px;top:90px;width:620px;height:540px;background:#14161c;border-radius:20px;padding:34px 36px;box-shadow:0 18px 40px rgba(0,0,0,.25)}
.slide .code pre{margin:0;font-family:"JetBrains Mono",Consolas,monospace;font-size:21px;line-height:1.6;color:#e6e6e6;white-space:pre}
.slide .k{color:#ff9e64}.slide .f{color:#7aa2f7}.slide .c{color:#7f8699}.slide .n{color:#9ece6a}
</style>
<div class="text"><h2>Binary search</h2><p class="key">Halve the search space on every step.</p><div class="cx"><p><strong>O(log n)</strong>time</p><p><strong>O(1)</strong>space</p></div></div>
<div class="code"><pre><span class="k">def</span> <span class="f">binary_search</span>(a, x):
    lo, hi = <span class="n">0</span>, len(a) - <span class="n">1</span>
    <span class="k">while</span> lo &lt;= hi:
        mid = (lo + hi) // <span class="n">2</span>
        <span class="k">if</span> a[mid] == x:
            <span class="k">return</span> mid
        <span class="k">if</span> a[mid] &lt; x:
            lo = mid + <span class="n">1</span>  <span class="c"># go right</span>
        <span class="k">else</span>:
            hi = mid - <span class="n">1</span>  <span class="c"># go left</span>
    <span class="k">return</span> -<span class="n">1</span></pre></div>`,
  },
  {
    id: "objectives-icons",
    name: "Objectives grid",
    tags: ["objectives", "aims", "scope", "introduction", "features", "none"],
    when: "Objectives / aims of a project: a short title + one-line purpose on top, then 4 objectives in a 2×2 grid with numbered squares — compact and scannable.",
    html: `<style>
.slide h2{position:absolute;left:80px;top:60px;width:700px;font-family:var(--font-heading);font-size:54px;color:var(--ink)}
.slide .purpose{position:absolute;left:80px;top:146px;width:900px;font-size:25px;color:var(--muted)}
.slide .grid{position:absolute;left:80px;top:240px;width:1120px;height:400px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:24px}
.slide .grid div{display:flex;gap:22px;align-items:center;background:var(--surface);border-radius:18px;padding:22px 28px}
.slide .grid b{flex:none;width:64px;height:64px;border-radius:14px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font-family:var(--font-heading);font-size:28px;display:flex;align-items:center;justify-content:center}
.slide .grid p{font-size:24px;line-height:1.35;color:var(--ink)}
</style>
<h2>Objectives</h2><p class="purpose">What the Smart Library system must achieve by the final review.</p>
<div class="grid"><div><b>01</b><p>Automate issue and return with RFID tags</p></div><div><b>02</b><p>Show live seat availability on a mobile app</p></div><div><b>03</b><p>Calculate fines and send reminders automatically</p></div><div><b>04</b><p>Give librarians a usage dashboard</p></div></div>`,
  },
  {
    id: "problem-solution",
    name: "Problem to solution split",
    tags: ["problem", "solution", "introduction", "motivation", "none", "photo"],
    when: "Motivation slide: left half states the problem with one hard fact on a dark field; right half the proposed solution on light, joined by an arrow badge at the seam.",
    html: `<style>
.slide .l{position:absolute;left:0;top:0;width:620px;height:720px;background:var(--ink)}
.slide .side{position:absolute;top:110px;width:460px;display:flex;flex-direction:column;gap:22px}
.slide .s1{left:80px}.slide .s2{left:720px}
.slide small{font-size:18px;letter-spacing:.2em;text-transform:uppercase;font-weight:700}
.slide .s1 small{color:var(--accent)}.slide .s2 small{color:var(--primary)}
.slide .s1 h3{font-family:var(--font-heading);font-size:44px;line-height:1.1;color:var(--bg)}
.slide .s2 h3{font-family:var(--font-heading);font-size:44px;line-height:1.1;color:var(--ink)}
.slide .s1 p{font-size:24px;line-height:1.4;color:color-mix(in srgb,var(--bg) 80%,transparent)}
.slide .s2 p{font-size:24px;line-height:1.4;color:var(--muted)}
.slide .arrow{position:absolute;left:576px;top:330px;width:88px;height:88px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center}
.slide .arrow i{display:block;width:26px;height:26px;border-top:6px solid var(--ink);border-right:6px solid var(--ink);transform:rotate(45deg);margin-left:-10px}
</style>
<div class="l"></div>
<div class="side s1"><small>Problem</small><h3>Students wait 15 minutes to issue a book</h3><p>Manual registers, lost records and no idea which seats are free.</p></div>
<div class="side s2"><small>Our solution</small><h3>Tap a card, walk out</h3><p>RFID issue counters and a live seat map on every phone.</p></div>
<div class="arrow"><i></i></div>`,
  },
];
