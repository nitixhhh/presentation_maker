---
title: DeckCraft AI
emoji: 📊
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# DeckCraft AI

Researched, designed presentations for Indian college students. Type a topic, and the engine:

1. researches real sources (Wikipedia, Crossref, OpenAlex, arXiv …) and writes cited facts,
2. plans the story slide by slide,
3. finds real photos where authenticity matters and makes AI images for concepts and covers,
4. **designs every slide with AI** (HTML/CSS, one slide at a time), renders it in Chromium, checks it, and lets the designer fix what broke,
5. exports a PDF, an editable PowerPoint and speaker notes.

The student sees a watermarked preview first and pays only if they like it (₹39 a deck, ₹149 for 5, first deck ₹9).

---

## Deploy on Hugging Face (from your phone)

1. Go to **huggingface.co → New Space**. Pick **Docker** → **Blank**. Hardware: *CPU basic* works; *CPU upgrade* is faster.
2. In the Space, open **Files → Add file → Import from GitHub**, or connect this repo (branch `engine-v3`). The `Dockerfile` in the repo is all HF needs.
3. Open **Settings → Variables and secrets** and add the secrets from the table below. At minimum: `GOOGLE_AI_API_KEY` and `APP_SECRET`.
4. Optional but recommended: **Settings → Persistent storage** (small). Decks are then kept on `/data`. Without it, use Supabase (below) so decks survive restarts.
5. The Space builds (about 10 minutes the first time) and opens at `https://<you>-<space>.hf.space`.

The container listens on port **7860**, runs as user 1000, and stores files in `/data/deckcraft`.

## Secrets and settings

Put these in HF *Secrets* (or `.env.local` when running locally). Never commit them.

**AI (free tiers)**

| Name | Needed? | Where to get it |
|---|---|---|
| `GOOGLE_AI_API_KEY` | **Yes** — main designer (Gemini Flash / Gemma) | aistudio.google.com/apikey |
| `GOOGLE_AI_API_KEY_2` … `_9` | Optional — more free capacity (use keys from *different* Google Cloud projects) | same |
| `GROQ_API_KEY` | Recommended — fast backup | console.groq.com/keys |
| `OPENROUTER_API_KEY` | Recommended — more free backup models | openrouter.ai/keys |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Recommended — **AI images (Flux)** + last-resort text model | dash.cloudflare.com → AI → Workers AI → "Use REST API" |
| `OPENALEX_API_KEY` | Optional — avoids scholarly-search limits | openalex.org (free) |
| `BENCHMARK_PASSWORD` | Optional — turns on `/benchmark` | any password you choose |

**Site**

| Name | Needed? | What it does |
|---|---|---|
| `APP_SECRET` | **Yes** | Long random text. Signs download and preview links. |
| `MAX_CONCURRENT_JOBS` | No (2) | Decks made at the same time |
| `MAX_QUEUED_PER_OWNER` | No (3) | Unfinished decks one person may have |

**Accounts + storage (Supabase)**

| Name | Needed? | What it does |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | For login + durable storage | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For login | Public anon key (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | For durable storage + payments data | **Secret.** Server only. |
| `REQUIRE_LOGIN` | No (true when Supabase is set) | `false` lets people make decks without signing in |

**Payments (Razorpay)**

| Name | Needed? | What it does |
|---|---|---|
| `RAZORPAY_KEY_ID` | To charge | `rzp_test_…` for test mode, `rzp_live_…` for real money |
| `RAZORPAY_KEY_SECRET` | To charge | **Secret** |
| `RAZORPAY_WEBHOOK_SECRET` | Recommended | The secret you type when you create the webhook |
| `PRICE_DECK_INR` / `PRICE_FIRST_DECK_INR` / `PRICE_PACK5_INR` | No (39 / 9 / 149) | Prices in rupees. First deck `0` = free. |
| `REFERRAL_CREDITS` | No (1) | Credits a user gets when a friend signs up with their link |
| `FREE_EDITS_PER_DECK` | No (2) | Slide edits included after unlocking |

**Without Razorpay keys the site is in free testing mode:** every deck is unlocked, nothing is charged.
Without Supabase, the site is open (no login) and stores everything on its own disk.

## Set up Supabase (login + storage)

1. supabase.com → New project. Open **SQL Editor**, paste `supabase/schema.sql`, Run. This makes the tables (jobs, profiles, credits, orders, unlocks) and a private `decks` storage bucket. Row-level security is on; only the server key can read them.
2. **Authentication → Providers → Google**: turn on. It asks for a Google *Client ID* and *Secret*: make them at console.cloud.google.com → APIs & Services → Credentials → OAuth client ID → Web application. Add the redirect URL Supabase shows you (`https://<project>.supabase.co/auth/v1/callback`).
3. **Authentication → URL Configuration**: Site URL = your Space URL. Add it to *Redirect URLs* too (`https://<you>-<space>.hf.space/**`).
4. Copy the URL, anon key and service-role key into the secrets above.

## Set up Razorpay (payments)

1. dashboard.razorpay.com → switch to **Test mode** → Account & Settings → API Keys → Generate. Copy the Key ID and Secret into `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. **Webhooks → Add new webhook**: URL `https://<your site>/api/pay/webhook`, events **order.paid** and **payment.captured**, and a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. Test cards: Razorpay's docs list test cards and UPI ids (e.g. `success@razorpay`). Nothing real is charged in test mode.
4. Going live: complete Razorpay KYC, then swap in the `rzp_live_` keys and a live webhook.

How it works: the server creates a Razorpay order for the exact price → Razorpay Checkout opens on the phone → the server checks the payment signature → the deck unlocks. The webhook confirms the same payment server-to-server, so a closed tab never loses a paid deck. Both are idempotent. The payment code sits behind one small interface (`src/server/payments/`), so another gateway can be added later without touching the rest.

## How students use it

* **Make a deck:** topic, slide count, language (English, Hindi, Hinglish). Optional: presenter names, roll no., guide, department, college, **college logo**, and the format their college wants. The designer places the logo and the details on the title slide.
* **Wait or leave:** the deck is made in the background. Closing the app is fine; "My decks" shows progress and finished decks (on every device after signing in).
* **Preview:** watermarked slide images. No text to copy, no files.
* **Unlock:** pay once (or use a credit) → clean PDF, editable PPTX, speaker notes (in the PPTX notes and as a separate PDF), full-screen present, and **2 free edits**: pick a slide, say what to change, the designer redoes that slide.
* **Invite:** each account has a referral link; a friend who signs up with it gives them a free deck credit.

## How a deck is made (`src/engine-v3`)

brief → research (cited facts, cached 7 days per topic) → outline → **image director** (AI chooses real photo vs AI image vs none per slide and writes one style prompt for all AI images of the deck) → photos (Wikimedia Commons / Openverse, a vision model picks the best; credits kept) + AI images (Cloudflare Flux; never charts, text or data) → art director (palette, fonts, motif, per-slide direction) → **designer AI per slide** with 2–3 example slides from the recipe library as inspiration → Chromium render → DOM checks (overflow, overlap, contrast, invented numbers) → vision check when something looks wrong → revise → exports.

Every design decision is made by the AI. Code only measures, renders and exports. There are no fixed fallback layouts: a slide that keeps breaking gets a fresh AI redesign.

### Free models: routing, quotas and failover

Each AI step has a role, and each role has its own ordered list of free models in `src/config/models.json → engineV3.roles`:

| Role | What it does | Default routes (best first) |
|---|---|---|
| `brief`, `research`, `outline` | understand the request, extract cited facts, plan the story | Gemini 3.5 / 3.1 Flash-Lite → Groq gpt-oss-120b → Gemma 4 → OpenRouter :free → Cloudflare |
| `art` | deck palette, fonts, per-slide art direction | Gemini 3.8 / 3.7 / 3.6 Flash → OpenRouter Nemotron 3 Ultra :free → Gemma 4 31B → Groq → Cloudflare |
| `design` | designs every slide (decides most of the quality) | Gemini 3.8 → 3.7 → 3.6 → 3.5 → 3 Flash → OpenRouter Nemotron 3 Ultra / Inkling :free → Gemma 4 31B → Groq gpt-oss-120b / Qwen 3.8 → Cloudflare |
| `vision` | looks at each rendered slide and critiques it | Gemini 3.6 / 3.5 Flash → Flash-Lite → Gemma 4 31B → OpenRouter Nemotron VL / Inkling :free → Groq Qwen 3.8 → Cloudflare Llama 4 Scout |

**The scheduler (`src/engine-v3/llm.ts`)** knows every model's free limits (`engineV3.models`: requests/min, requests/day, tokens/min, tokens/day) and keeps a live budget per key. It never sends a request it knows will be refused, reads `Retry-After` / Gemini `retryDelay` / Groq "try again in 7m" on a 429, and marks a model as used up for today when the provider says the daily quota is gone. That state is saved to disk, so it survives restarts. It fails over to the next route at once. For `design` and `art` it first waits a few seconds for the better model. When everything is busy the deck simply waits ("High demand on the free AI models — slowing down a little" on the progress screen). It gives up only after `V3_MAX_CAPACITY_WAIT_MIN` (default 20) minutes with no capacity at all.

**More keys = more free capacity.** Every provider accepts several keys: `GOOGLE_AI_API_KEY`, `GOOGLE_AI_API_KEY_2` … `_9` (or `GOOGLE_AI_API_KEYS=k1,k2`). Gemini limits are per Google Cloud *project*, so keys from different projects add up. Keys from the same project share one quota.

**Free-tier facts (checked 30 Oct 2026, from the providers' own pages/replies):**
* **Groq free plan** (console.groq.com/docs/rate-limits): only `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` (+ Whisper): 30 req/min, 1,000 req/day, **8,000 tokens/min**, 200k tokens/day. Kimi K2 and Llama 4 Scout are no longer offered on Groq. 8k tokens/min means one big slide-design request can exceed it; the scheduler then skips Groq for that request.
* **Gemini free tier** (ai.google.dev pricing lists these as free; limits from Google's own 429 replies on a free key): Flash models (`gemini-3.8-flash`, `3.7`, `3.6`, `3.5`, `3-flash-preview`) **20 requests/day each**. Flash-Lite (`gemini-3.5-flash-lite`, `3.1-flash-lite`) 500/day each. Resets at midnight Pacific. Every Flash model has its own daily quota, so the routes rotate through them. Gemma 4 (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`) is free with much higher limits, but in testing its endpoint often answered HTTP 500 (the scheduler retries/fails over).
* **OpenRouter** free models (`:free`): 20 req/min and 50 req/day per account in total (1,000/day once you have bought $10 of credits ever → set `V3_ACCOUNT_OPENROUTER_RPD=1000`).
* **Cloudflare Workers AI**: 10,000 Neurons/day free, shared by all models (≈15–20 slide designs with gpt-oss-120b, or ~200 Flux Schnell images). Kimi and GLM on Workers AI need a paid plan.

**Rough daily capacity on ONE free key per provider:** Gemini Flash ≈ 100 strong calls/day + Gemma. A 10-slide deck uses about 10 designs + 1 art direction + a few revisions + a few vision checks ≈ 20–30 strong calls. So expect a few top-quality decks per Google project per day. After that, decks continue on Gemma / OpenRouter / Groq at lower quality. Add keys from more projects to scale.

**Use the benchmark** (`/benchmark`, set `BENCHMARK_PASSWORD`) to run the same topic through several models for one role on *your* keys. It shows QA score, clean-slide count, time and the slides side by side, so you can reorder `engineV3.roles`.

**Waste cuts (no design calls removed):** research results are cached per topic for 7 days (`V3_RESEARCH_CACHE_DAYS`, `V3_RESEARCH_CACHE=off`). The same source query is never fetched twice. Vision QA runs only on slides whose DOM checks found a problem, plus the title slide (`V3_VISION_QA=smart` default; `always` / `off`). A slide that passed is never re-checked.

**Design recipe library** (`src/engine-v3/design/recipes.ts`): 38 hand-made example slides (title, agenda, definition, annotated photo, processes, cycle, comparisons, table, pros/cons, stats, chart, timelines, quote, image-led, architecture, hub, formula, applications, code, objectives, problem→solution, conclusions, closings). For every slide the engine picks 2–3 relevant ones and shows them to the designer AI as *inspiration* (technique, not layout). The designer still designs every slide itself. There is no fixed fallback layout any more: a slide that keeps breaking gets a fresh AI redesign. The only engine-made slide is an exact reference list, used if the AI's references slide drops a citation.


## Run it on your computer

```
npm install
npx playwright install chromium
cp .env.example .env.local     # add at least GOOGLE_AI_API_KEY
npm run dev                    # http://localhost:3000
```

Make a deck from the command line: `npx tsx scripts/v3-generate.ts "Photosynthesis" 8`.
Add engine-made decks to the homepage gallery: `npx tsx scripts/make-gallery.ts <deckId> …` (copies the rendered slide images into `public/gallery`).

For local payment tests without Razorpay: `PAYMENTS_PROVIDER=mock` (only works when `NODE_ENV` is not production).

## Security notes

* All keys are read on the server only. The browser gets just the Supabase URL + anon key and the Razorpay key id (both public by design).
* Locked decks expose only watermarked JPEGs. Clean files are served through signed links that expire in 5 minutes, and only to the owner of an unlocked deck.
* Payments are verified on the server (signature + webhook), never trusted from the browser.
* Rate limits on deck creation, payments, uploads and edits; the job queue limits each person to 3 unfinished decks.
* Uploaded logos are decoded and re-encoded as PNG (max 3 MB, max 800 px).
