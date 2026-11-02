Build a full-stack web app: an AI presentation maker. Users pay a fixed Rs 20 per presentation. No verified payment = no generation. Every presentation must be visually unique and richly designed, never a generic "title + bullets" deck.

0. CONSTRAINTS
- Free-tier AI APIs only for now. Expected load at launch: about 2-4 presentations per day. Design everything to stay inside free quotas; paid providers will be added later by editing config only.
- Mobile-first UI. Hindi/English/Hinglish content supported.

1. STACK
Next.js (App Router) + TypeScript + Tailwind, Postgres (Supabase), zod for schemas, Playwright for render QA, pptxgenjs for PPTX export. Run generation in a separate long-running worker with a Postgres-backed job queue (not inside a serverless request). Ask me before choosing any hosting or paid service.

2. USER FLOW
Landing -> options form -> capacity check -> create order -> pay Rs 20 -> payment approved -> generation job with live progress -> preview -> download (PPTX, PDF, HTML slideshow).

3. CAPACITY GATE
- MAX_DAILY_ORDERS (env, default 4). Before showing the payment screen, check today's remaining slots and provider quota health. If full, show "Today's slots are full, come back tomorrow" and do NOT take payment.
- If providers run out of quota mid-job after payment, queue the job and resume at the next quota reset. Never lose or double-charge a paid order.

4. USER OPTIONS (everything customizable, plus "Surprise me")
Topic/brief, audience, tone, slide count, language, visual style, font choice or auto, color palette or auto, image source (stock / AI / none), toggles for charts, diagrams, code blocks, icons, speaker notes.

5. PAYMENT (manual now, auto later)
- PaymentProvider interface: createOrder(), getStatus(), approve(). Implement ManualUpiProvider now; leave a RazorpayProvider stub for later.
- Manual flow: show my static Google Pay QR from /public/gpay-qr.png with the exact amount Rs 20. User pays, then submits their 12-digit UTR (optional screenshot). Order -> "pending_review".
- Admin page (password from env): approve/reject pending orders. Block duplicate UTRs.
- POST /api/generate returns 402 unless order.status === "paid". One order = one presentation.
- If generation fails: auto-retry, keep the order retryable. If content is refused by policy after payment, mark it "refund_due" for manual refund.

6. AGENT SYSTEM (owner + sub-agents, NOT one LLM call)
Agents: Owner, Researcher, ArtDirector, SlideWriter, DiagramCodeSpecialist, ImagePromptWriter, VisionQA, ImageGenerator.
Loop:
a) Owner writes a task brief per sub-agent: goal, output JSON schema, acceptance criteria.
b) Sub-agents return strict JSON (validate with zod; on invalid JSON run one repair prompt).
c) Deterministic checks first, no LLM: schema, word limits, Playwright text overflow and contrast, repeated layouts, empty space.
d) Owner reviews with an LLM only at checkpoints: after outline, after design DNA, final deck. Per-slide checks are code-only.
e) On failure the Owner writes specific fix instructions and only that sub-agent reruns. Max 2 retries per task, then fallback model, then mark the order retryable.
f) Budget: aim for 25 LLM calls or fewer per presentation.

7. PLATFORMS AND ROUTING (models.json, edit config only, never code)
Adapters (OpenAI-compatible where possible): Google AI Studio, NVIDIA NIM, GroqCloud, Cloudflare Workers AI, OpenRouter (:free), Hugging Face Inference Providers.
Each agent -> { primary, fallbacks[] }:
- Owner: Google AI Studio (Flash-class) -> Groq gpt-oss-120b
- Researcher, SlideWriter: NVIDIA NIM -> Groq
- ArtDirector: Google AI Studio -> Cloudflare (Llama 70B class)
- DiagramCodeSpecialist: Groq gpt-oss-120b -> NVIDIA coder model
- ImagePromptWriter: small Cloudflare model -> Groq small model
- VisionQA: Google AI Studio (vision) -> Cloudflare Llama Vision
- ImageGenerator: Cloudflare FLUX schnell -> Unsplash/Pexels
- Emergency backup for any agent: OpenRouter :free
- Hugging Face: only special tasks (embeddings, niche models); its free credits are tiny.
Per-provider config fields: enabled, allowedForProduction, limits {rpm, rpd, tokensPerDay | neuronsPerDay | creditsPerMonth}. Set NVIDIA allowedForProduction=false by default until I verify its free-tier terms; routing must fall back automatically.
Reliability: per-provider quota tracker, skip a provider at 80% of its limit, respect 429 retry-after, circuit breaker after repeated failures, response cache by prompt hash, low-concurrency job queue. Use ONE account/key per provider; never create multiple accounts to bypass limits.
Do not rely on native function calling (many free models lack it): implement my own tool loop where the model returns {tool, args} JSON, the server runs the tool, and feeds the result back.
Log provider, model, latency, tokens for every call.

8. TOOLS THE AGENTS CAN CALL
web_search(query) via a free search API; search_stock_images(query, orientation, color) with attribution; generate_image(prompt, style); create_chart(type, data, theme) -> SVG/PNG (ECharts); create_diagram(kind, spec) via Mermaid -> SVG (flowchart, timeline, mindmap, architecture); render_code(snippet, language, theme); get_icons(keyword); pick_fonts(mood, language) from a curated Google Fonts pairing list that includes Devanagari-capable fonts; get_palette(mood, seed).

9. UNIQUENESS AND DESIGN
- ArtDirector creates a "design DNA" per order (palette, font pair, layout set, motif, image mood) from topic + random seed, avoiding recently used combos stored in the DB.
- Library of 25+ layouts (hero, split, big-number, timeline, comparison, quote, grid, full-bleed image, chart, diagram, code, etc.).
- Rules: no two decks share palette + font pair + layout sequence; every slide has a visual element; max 2 consecutive slides with the same layout; readable font sizes and contrast.

10. EXPORT
PPTX (pptxgenjs), PDF (Playwright), standalone HTML slideshow. Outputs deleted after 7 days.

11. SECURITY, POLICY, PRIVACY
Rate limiting, input validation, protection against prompt injection from web content, API keys server-side only, admin auth. Refuse hateful, sexual, illegal content. Show a privacy note that topics may be processed by third-party AI providers whose free tiers may use inputs to improve their models. Credit stock-image authors.

12. BUILD PHASES AND DELIVERABLES
Phase 1: generation pipeline (agents, router, tools, QA, export) with no payment.
Phase 2: manual payment, admin page, capacity gate.
Phase 3: polish, progress UI, error handling.
Later (do not build now): paid providers, Razorpay auto-verification.
Deliver: .env.example, README, seed script for the layout library and font/palette lists, and a short test for the agent loop.