import { PresentationDeck } from "@/schemas/presentation";

export function generateSlideshowHtml(deck: PresentationDeck): string {
  const { designDna, slides } = deck;
  const { palette, fontPair } = designDna;

  const slidesMarkup = slides
    .map((slide, idx) => {
      let visualContentHtml = "";

      if (slide.visualElement.type === "image") {
        visualContentHtml = `
          <div class="visual-container image-card">
            <img src="${slide.visualElement.url}" alt="${slide.visualElement.alt}" class="slide-image" />
            ${slide.visualElement.credit ? `<div class="image-credit">Photo by ${slide.visualElement.credit}</div>` : ""}
          </div>
        `;
      } else if (slide.visualElement.type === "stat") {
        visualContentHtml = `
          <div class="visual-container stat-card">
            <div class="stat-number glow-text">${slide.visualElement.number}</div>
            <div class="stat-label">${slide.visualElement.label}</div>
            ${slide.visualElement.supportingText ? `<div class="stat-sub">${slide.visualElement.supportingText}</div>` : ""}
          </div>
        `;
      } else if (slide.visualElement.type === "cards") {
        visualContentHtml = `
          <div class="visual-container cards-grid">
            ${slide.visualElement.items
              .map(
                (item) => `
              <div class="grid-card">
                <div class="card-title">${item.title}</div>
                <div class="card-desc">${item.description}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `;
      } else if (slide.visualElement.type === "quote") {
        visualContentHtml = `
          <div class="visual-container quote-card">
            <div class="quote-mark">“</div>
            <div class="quote-text">${slide.visualElement.quote}</div>
            <div class="quote-author">— ${slide.visualElement.author}${slide.visualElement.role ? `, <span class="quote-role">${slide.visualElement.role}</span>` : ""}</div>
          </div>
        `;
      } else if (slide.visualElement.type === "code") {
        visualContentHtml = `
          <div class="visual-container code-card">
            <div class="code-header">
              <span class="code-dot red"></span>
              <span class="code-dot yellow"></span>
              <span class="code-dot green"></span>
              <span class="code-lang">${slide.visualElement.language}</span>
            </div>
            <pre><code>${slide.visualElement.snippet.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
          </div>
        `;
      } else if (slide.visualElement.type === "chart") {
        visualContentHtml = `
          <div class="visual-container chart-card">
            <div class="chart-header">${slide.visualElement.title || "Data Visualization"}</div>
            <div id="chart-${idx}" class="echart-box" data-options='${JSON.stringify(slide.visualElement.echartsOption)}'></div>
          </div>
        `;
      } else if (slide.visualElement.type === "diagram") {
        visualContentHtml = `
          <div class="visual-container diagram-card">
            <pre class="mermaid">${slide.visualElement.mermaidSyntax}</pre>
          </div>
        `;
      } else if (slide.visualElement.type === "comparison") {
        visualContentHtml = `
          <div class="visual-container comparison-grid">
            <div class="compare-col left-col">
              <div class="compare-head">${slide.visualElement.leftHeader}</div>
              <ul>${slide.visualElement.leftPoints.map((p) => `<li>${p}</li>`).join("")}</ul>
            </div>
            <div class="compare-col right-col">
              <div class="compare-head highlight">${slide.visualElement.rightHeader}</div>
              <ul>${slide.visualElement.rightPoints.map((p) => `<li>${p}</li>`).join("")}</ul>
            </div>
          </div>
        `;
      }

      return `
        <section id="slide-${idx}" class="slide ${idx === 0 ? "active" : ""}" data-slide-index="${idx}">
          <div class="slide-inner ${slide.layoutType}">
            <div class="slide-header">
              <span class="slide-badge">0${idx + 1} / 0${slides.length}</span>
              <span class="deck-topic">${deck.topic}</span>
            </div>

            <div class="slide-body">
              <div class="slide-text-content">
                <h2 class="slide-title">${slide.title}</h2>
                ${slide.subtitle ? `<h3 class="slide-subtitle">${slide.subtitle}</h3>` : ""}
                ${
                  slide.bodyPoints.length > 0
                    ? `<ul class="bullet-list">
                    ${slide.bodyPoints.map((bp) => `<li class="bullet-item"><span class="bullet-dot"></span><span>${bp}</span></li>`).join("")}
                  </ul>`
                    : ""
                }
              </div>

              <div class="slide-visual-content">
                ${visualContentHtml}
              </div>
            </div>

            ${
              slide.speakerNotes
                ? `
              <aside class="speaker-notes">
                <strong>Speaker Notes:</strong> ${slide.speakerNotes}
              </aside>
            `
                : ""
            }
          </div>
        </section>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${deck.topic} - Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontPair.googleFontUrl}" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
  </script>
  <style>
    :root {
      --bg: ${palette.background};
      --surface: ${palette.surface};
      --primary: ${palette.primary};
      --secondary: ${palette.secondary};
      --accent: ${palette.accent};
      --text: ${palette.text};
      --muted: ${palette.mutedText};
      --border: ${palette.border};
      --font-heading: '${fontPair.headingFont}', sans-serif;
      --font-body: '${fontPair.bodyFont}', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide {
      position: absolute;
      width: 1920px;
      height: 1080px;
      max-width: 100vw;
      max-height: 56.25vw;
      aspect-ratio: 16 / 9;
      background: var(--bg);
      background-image: radial-gradient(circle at 10% 20%, rgba(193, 91, 62, 0.06) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(255, 59, 48, 0.04) 0%, transparent 40%);
      display: none;
      flex-direction: column;
      padding: 60px 80px;
      overflow: hidden;
    }

    .slide.active {
      display: flex;
    }

    .slide-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: space-between;
    }

    .slide-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      font-size: 14px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .slide-badge {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 4px 12px;
      border-radius: 999px;
      color: var(--primary);
      font-weight: 600;
    }

    .slide-body {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 60px;
      align-items: center;
      flex: 1;
      margin: 40px 0;
    }

    .slide-title {
      font-family: var(--font-heading);
      font-size: clamp(32px, 3.2vw, 48px);
      font-weight: 800;
      line-height: 1.15;
      color: var(--text);
      margin-bottom: 20px;
      word-break: break-word;
      background: linear-gradient(135deg, var(--text) 40%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .slide-subtitle {
      font-size: clamp(18px, 1.6vw, 22px);
      font-weight: 500;
      color: var(--muted);
      margin-bottom: 24px;
      line-height: 1.4;
      word-break: break-word;
    }

    .bullet-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bullet-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      font-size: 18px;
      line-height: 1.5;
      color: var(--text);
      word-break: break-word;
    }

    .bullet-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--primary);
      margin-top: 10px;
      flex-shrink: 0;
      box-shadow: 0 0 10px var(--primary);
    }

    .visual-container {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
      max-height: 520px;
      position: relative;
      overflow: hidden;
    }

    .slide-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 12px;
    }

    .image-credit {
      position: absolute;
      bottom: 12px;
      right: 16px;
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      background: rgba(0,0,0,0.6);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .stat-number {
      font-family: var(--font-heading);
      font-size: 96px;
      font-weight: 900;
      color: var(--primary);
      line-height: 1;
      margin-bottom: 16px;
    }

    .stat-label {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 10px;
    }

    .stat-sub {
      font-size: 18px;
      color: var(--muted);
    }

    .cards-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .grid-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      padding: 18px 24px;
      border-radius: 12px;
    }

    .card-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--secondary);
      margin-bottom: 6px;
    }

    .card-desc {
      font-size: 16px;
      color: var(--muted);
      line-height: 1.4;
    }

    .quote-mark {
      font-size: 90px;
      color: var(--primary);
      opacity: 0.3;
      line-height: 0.8;
    }

    .quote-text {
      font-size: 28px;
      font-style: italic;
      color: var(--text);
      line-height: 1.4;
      margin-bottom: 24px;
    }

    .quote-author {
      font-size: 18px;
      font-weight: 600;
      color: var(--secondary);
    }

    .echart-box {
      width: 100%;
      height: 420px;
    }

    .speaker-notes {
      display: none;
      background: rgba(0,0,0,0.85);
      border-top: 1px solid var(--border);
      padding: 16px 24px;
      font-size: 15px;
      color: var(--muted);
      border-radius: 8px;
    }

    /* Controls Overlay */
    .nav-controls {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      gap: 12px;
      z-index: 1000;
    }

    .nav-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .nav-btn:hover {
      background: var(--primary);
      color: #fff;
    }
  </style>
</head>
<body>
  ${slidesMarkup}

  <div class="nav-controls">
    <button class="nav-btn" onclick="prevSlide()">← Prev</button>
    <button class="nav-btn" onclick="nextSlide()">Next →</button>
    <button class="nav-btn" onclick="toggleNotes()">Notes</button>
  </div>

  <script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');

    function showSlide(index) {
      if (index < 0 || index >= slides.length) return;
      slides[currentSlide].classList.remove('active');
      currentSlide = index;
      slides[currentSlide].classList.add('active');

      // Initialize chart if present on this slide
      const chartEl = slides[currentSlide].querySelector('.echart-box');
      if (chartEl && !chartEl.dataset.initialized) {
        const options = JSON.parse(chartEl.dataset.options);
        const myChart = echarts.init(chartEl);
        myChart.setOption(options);
        chartEl.dataset.initialized = "true";
      }
    }

    function prevSlide() { showSlide(currentSlide - 1); }
    function nextSlide() { showSlide(currentSlide + 1); }
    function toggleNotes() {
      const notes = document.querySelectorAll('.speaker-notes');
      notes.forEach(n => n.style.display = n.style.display === 'block' ? 'none' : 'block');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 's') toggleNotes();
    });

    // Initialize first slide chart
    showSlide(0);
  </script>
</body>
</html>`;
}
