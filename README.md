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

Researched, designed presentations for Indian college students. Three engines, one per plan (see **Three plans** below). Type a topic, and the Basic engine:

1. researches real sources (Wikipedia, Crossref, OpenAlex, arXiv …) and writes cited facts,
2. plans the story slide by slide,
3. finds real photos where authenticity matters and makes AI images for concepts and covers,
4. **designs every slide with AI** (HTML/CSS, one slide at a time), renders it in Chromium, checks it, and lets the designer fix what broke,
5. exports a PDF, an editable PowerPoint and speaker notes.

The student sees a watermarked preview first and pays only if they like it (₹39 a deck, ₹149 for 5, first deck ₹9).

## Three plans, three engines

DeckCraft has exactly three engines. Each one is a plan (tier) a student can pick at release. All future engine work happens inside these three folders.

| Plan | Engine | Folder | What it does | Time per deck* | AI calls* |
|---|---|---|---|---|---|
| **Basic** | v3 | `src/engine-v3` | AI designs every slide one at a time (own palette per topic, drawn diagrams), renders it in Chromium, checks and fixes it | ~9–13 min | 70–90 |
| **Standard** | v5 | `src/engine-v5` | One planner call fills 30 designer-made layouts; code renders, fits and checks every slide; peer-reviewed papers; photo vet | ~2.5–3 min | 12–15 |
| **Advanced** | v6 | `src/engine-v6` (+ v5 layouts) | Plan first (editable outline cards) → approve → a style generated for the topic ("Surprise me" or 3 looks) → drawn charts/flowcharts → AI images preselected → chat edit | ~2–4.5 min | ~18 |

\*Measured on the free models, Nov 2026, 8–10 slides.

The plan registry (names, one-line descriptions, times, price placeholders, example slides) is **`src/server/plans.ts`**. Which engine a deck gets is decided in **`src/server/engineChoice.ts`**.

### Who sees what

* Every visitor gets `ENGINE_DEFAULT` (v3 = Basic unless set; it also accepts `basic` / `standard` / `advanced`).
* The owner (`OWNER_USER_IDS` and/or `OWNER_EMAILS`) sees the plan picker on the create form and the **`/plans`** page: each plan's name, what it does, time per deck, price placeholder, and 6 real slides it made (`public/plans/<plan>/*.webp`).
* **Release switch: `PLANS_PUBLIC=true`.** The picker and `/plans` then show for everyone, and anyone may pick a plan. Until then `/plans` and `/api/plans` answer 404 to everyone but the owner.
* Prices are placeholders ("Price coming soon"). Set `PLAN_PRICE_BASIC`, `PLAN_PRICE_STANDARD`, `PLAN_PRICE_ADVANCED` (any text, e.g. `Rs 49 a deck`) or fill `price` in `src/server/plans.ts`. No payment is tied to a plan yet; the existing per-deck pricing is unchanged.

To switch tiers for everyone without code: set `ENGINE_DEFAULT` on the host. To change a plan's example slides: replace the files in `public/plans/<plan>/` (960×540 WebP) and their alt text in `plans.ts`.

### Folder map

```
src/
  app/                 Next.js pages + API routes (/create, /plans, /api/v3/*, /api/plans, /api/me, /api/pay/*)
  components/app/      create form (plan picker), live progress, Advanced plan flow (PlanFlow), deck view + chat edit
  components/plans/    /plans page
  server/              jobs queue (jobs/manager.ts, jobs/v6.ts), plans.ts, engineChoice.ts, auth, storage, payments
  engine-v3/           Basic engine — and the shared core every engine uses: LLM router (llm.ts), research,
                       store, HTML render + DOM checks, PDF/PPTX/PNG exports, privacy placeholders
  engine-v5/           Standard engine: templates, themes, planner, fit, citations, photo vet
  engine-v6/           Advanced engine: plan step, generated style + WCAG contrast, charts, flowcharts, previews
  engine-common/       pieces shared by Standard and Advanced: icon library, deeper research, placeholder gate,
                       live slide events, Mermaid fallback, photo rules
  config/models.json   free model routes per role
```

The retired v4 (Agents) engine lives on the `engine-v4` branch. Decks it already saved still open, edit and download.

---

## Deploy on Hugging Face (from your phone)

1. Go to **huggingface.co → New Space**. Pick **Docker** → **Blank**. Hardware: *CPU basic* works; *CPU upgrade* is faster.
2. In the Space, open **Files → Add file → Import from GitHub**, or connect this repo (branch `engine-v3`). The `Dockerfile` in the repo is all HF needs.
3. Open **Settings → Variables and secrets** and add the secrets from the table below. At minimum: `GOOGLE_AI_API_KEY` and `APP_SECRET`.
4. Optional but recommended: **Settings → Persistent storage** (small). Decks are then kept on `/data`. Without it, use Supabase (below) so decks survive restarts.
5. The Space builds (about 10 minutes the first time) and opens at `https://<you>-<space>.hf.space`.

The container listens on port **7860**, runs as user 1000, and stores files in `/data/deckcraft`.

## Recommended setup (100% free)

Put these keys in HF Secrets — one account per provider, all free:

| Secret | Value |
|---|---|
| `NVIDIA_NIM_API_KEY` | your key from build.nvidia.com |
| `ALLOW_NVIDIA_PRODUCTION` | `true` |
| `GOOGLE_AI_API_KEY` | your key from aistudio.google.com/apikey |
| `OPENROUTER_API_KEY` | your key from openrouter.ai/keys |
| `GROQ_API_KEY` | your key from console.groq.com/keys (small steps) |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | AI images + last resort |
| `OLLAMA_API_KEY` | **leave empty** (paid, for later) |

What the slide designer then uses, in this order (the engine moves to the next one by itself when a model is busy or its daily limit is used up):

1. **NVIDIA (free trial API):** Kimi K2.6 → DeepSeek V4.1 Flash → GLM-5.3-Flash
2. **Google Gemini Flash (free):** 3.8 → 3.7 → 3.6 → 3.5 → 3 Flash (20 requests/day each)
3. **OpenRouter free:** Inkling → Nemotron 3.5 Super VL → Nemotron 3 Ultra
4. **Gemma 4** 26B → 31B (Google free; 31B failed ~90% of calls for an hour on 31 Oct 2026, so 26B goes first) → Groq gpt-oss-120b → Cloudflare

Vision checks: NVIDIA Kimi K2.6 → Gemini 3.6 / 3.5 Flash → Flash-Lite → OpenRouter Nemotron 3.5 Super VL / Inkling → Gemma 4. Brief, research and outline: Gemini Flash-Lite → Groq → Gemma → OpenRouter → (NVIDIA DeepSeek / GLM as backup).

**Know the risk of step 1:** NVIDIA's trial terms say its free API is for testing, not production. Fine for a small beta; NVIDIA can switch the key off without notice. If that happens nothing breaks — decks continue on Gemini → OpenRouter → Gemma, just with lower quality on busy days.

Every finished deck writes one line to the server log, e.g. `[v3/usage] deck … : 54 AI calls, 310k in / 140k out tokens, paid cost ~$0.000 — nvidia:moonshotai/kimi-k2.6 31 calls … | google:gemini-3.6-flash 12 calls …`, and the same numbers are saved in the deck record (`usage`). With the free setup the paid cost stays 0.

## Secrets and settings

Put these in HF *Secrets* (or `.env.local` when running locally). Never commit them.

**AI (free tiers)**

| Name | Needed? | Where to get it |
|---|---|---|
| `GOOGLE_AI_API_KEY` | **Yes** — main designer (Gemini Flash / Gemma) | aistudio.google.com/apikey |
| `GOOGLE_AI_API_KEY_2` … `_9` | Optional — e.g. a paid key next to the free one. Limits are per Google *project*; don't create extra projects/accounts just to multiply free quota (Google's terms: "will not attempt to circumvent" limits) | same |
| `GROQ_API_KEY` | Recommended — fast backup | console.groq.com/keys |
| `OPENROUTER_API_KEY` | Recommended — more free backup models | openrouter.ai/keys |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Recommended — **AI images** (FLUX.1 schnell for Basic/Standard, FLUX.2 klein 4B for Advanced) + last-resort text model | dash.cloudflare.com → AI → Workers AI → "Use REST API" |
| `OPENALEX_API_KEY` | Optional — avoids scholarly-search limits | openalex.org (free) |
| `BENCHMARK_PASSWORD` | Optional — turns on `/benchmark` | any password you choose |
| `NVIDIA_NIM_API_KEY` | Optional — Kimi K2.6, DeepSeek V4.1 Flash, GLM-5.3-Flash… free on NVIDIA. Used on **/benchmark only**, unless you also set `ALLOW_NVIDIA_PRODUCTION` | build.nvidia.com → Get API Key |
| `ALLOW_NVIDIA_PRODUCTION` | Optional (`true`) — **your own risk**: puts NVIDIA's Kimi K2.6 / DeepSeek V4.1 Flash / GLM-5.3-Flash first in the designer chain for real decks. See the NVIDIA note below | — |
| `OLLAMA_API_KEY` | **Paid — optional, later.** Leave empty for the free setup: without this key Ollama is never used. Ollama Cloud = strong models (GLM-5.3-Flash, DeepSeek V4.1 Flash, Kimi K2.6) paid per token, no server needed | ollama.com → Settings → API keys |
| `OLLAMA_PRIORITY` | Optional — `last` = use Ollama only after every free model is busy (default: right after free Gemini Flash, quality first) | — |
| `DESIGN_RECIPES` | Optional — `off` turns off the 38 example slides in the designer prompt. Recommended `off` when Gemma does most of the designing (see the recipes A/B below) | — |

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
   **Already have old DeckCraft (v2) tables in this project?** Just run the file as it is. Step 0 at its top finds any old `jobs` / `profiles` / `credit_events` / `orders` / `unlocks` / `deck_edits` table that lacks the v3 columns and renames it to `<name>_old_v2` (for example `jobs_old_v2`) — nothing is deleted, your old rows stay there — then creates the fresh v3 tables. (This fixes `ERROR 42703: column "owner_key" does not exist`.) Running the file again later is safe.
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

## How a Basic deck is made (`src/engine-v3`)

brief → research (cited facts, cached 7 days per topic) → outline → **image director** (AI chooses real photo vs AI image vs none per slide and writes one style prompt for all AI images of the deck) → photos (Wikimedia Commons / Openverse, a vision model picks the best; credits kept) + AI images (Cloudflare Flux; never charts, text or data) → art director (palette, fonts, motif, per-slide direction) → **designer AI per slide** with 2–3 example slides from the recipe library as inspiration → Chromium render → DOM checks (overflow, overlap, contrast, invented numbers) → vision check when something looks wrong → revise → exports.

Every design decision is made by the AI. Code only measures, renders and exports. There are no fixed fallback layouts: a slide that keeps breaking gets a fresh AI redesign.

### Free models: routing, quotas and failover

Each AI step has a role, and each role has its own ordered list of free models in `src/config/models.json → engineV3.roles`:

| Role | What it does | Default routes (best first) |
|---|---|---|
| `brief`, `research`, `outline` | understand the request, extract cited facts, plan the story | Gemini 3.5 / 3.1 Flash-Lite → Groq gpt-oss-120b → Gemma 4 → OpenRouter :free → Cloudflare |
| `art` | deck palette, fonts, per-slide art direction | Gemini 3.8 / 3.7 / 3.6 Flash → (Ollama DeepSeek V4.1 Flash, if key) → OpenRouter Inkling / Nemotron 3 Ultra :free → Gemma 4 → Groq → Cloudflare |
| `design` | designs every slide (decides most of the quality) | (NVIDIA Kimi K2.6 / DeepSeek / GLM if `ALLOW_NVIDIA_PRODUCTION`) → Gemini 3.8 → 3.7 → 3.6 → 3.5 → 3 Flash → (Ollama DeepSeek V4.1 Flash / GLM-5.3-Flash, if key) → OpenRouter Inkling / Nemotron 3.5 Super VL / Nemotron 3 Ultra :free → Gemma 4 31B / 26B → Groq gpt-oss-120b / Qwen 3.8 → Cloudflare |
| `vision` | looks at each rendered slide and critiques it | Gemini 3.6 / 3.5 Flash → Flash-Lite → (Ollama Gemma 4, if key) → OpenRouter Nemotron 3.5 Super VL / Inkling :free → Gemma 4 → Groq Qwen 3.8 → Cloudflare Llama 4 Scout |

**The scheduler (`src/engine-v3/llm.ts`)** knows every model's free limits (`engineV3.models`: requests/min, requests/day, tokens/min, tokens/day) and keeps a live budget per key. It never sends a request it knows will be refused, reads `Retry-After` / Gemini `retryDelay` / Groq "try again in 7m" on a 429, and marks a model as used up for today when the provider says the daily quota is gone. That state is saved to disk, so it survives restarts. It fails over to the next route at once. For `design` and `art` it first waits a few seconds for the better model. When everything is busy the deck simply waits ("High demand on the free AI models — slowing down a little" on the progress screen). It gives up only after `V3_MAX_CAPACITY_WAIT_MIN` (default 20) minutes with no capacity at all.

**Several keys per provider** are accepted (`GOOGLE_AI_API_KEY`, `GOOGLE_AI_API_KEY_2` … `_9`, or `GOOGLE_AI_API_KEYS=k1,k2`) — useful for a free key plus a paid key. Keys from the same Google project share one quota. **Do not create several accounts/projects of the same provider to multiply free limits**: OpenRouter's terms forbid "create multiple accounts as a single user, for purposes of bypassing or circumventing use limits" (account termination, credits not refunded), and Google's API terms say you "will not attempt to circumvent" limits. One account per provider, several providers — that is what the failover is for.

**Free-tier facts (checked 30 Oct 2026, from the providers' own pages/replies):**
* **Groq free plan** (console.groq.com/docs/rate-limits): only `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` (+ Whisper): 30 req/min, 1,000 req/day, **8,000 tokens/min**, 200k tokens/day. Kimi K2 and Llama 4 Scout are no longer offered on Groq. 8k tokens/min means one big slide-design request can exceed it; the scheduler then skips Groq for that request.
* **Gemini free tier** (ai.google.dev pricing lists these as free; limits from Google's own 429 replies on a free key): Flash models (`gemini-3.8-flash`, `3.7`, `3.6`, `3.5`, `3-flash-preview`) **20 requests/day each**. Flash-Lite (`gemini-3.5-flash-lite`, `3.1-flash-lite`) 500/day each. Resets at midnight Pacific. Every Flash model has its own daily quota, so the routes rotate through them. Gemma 4 (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`) is free with much higher limits, but in testing its endpoint often answered HTTP 500 (the scheduler retries/fails over).
* **OpenRouter** free models (`:free`, checked 31 Oct 2026 on openrouter.ai/api/v1/models): Gemma 4 31B / 26B (vision), Nemotron 3 Ultra 550B, Nemotron 3.5 Super VL (vision), Nemotron 3.5 Lightning, Inkling / Inkling Small (vision), Laguna, Dots 3 Note… There is **no** free Kimi, DeepSeek, Qwen, GLM or Llama on OpenRouter. Limits (openrouter.ai/docs/api-reference/limits): 20 req/min and 50 req/day per account across all free models; **1,000/day once the account has bought at least 10 credits ever** → set `V3_ACCOUNT_OPENROUTER_RPD=1000`. That one purchase is the biggest legit capacity boost.
* **NVIDIA build.nvidia.com**: has Kimi K2.6, DeepSeek V4.1 Flash, GLM-5.3-Flash, MiniMax M3.1 Flash, Mistral Large 4 for free, but its Trial Terms allow use "only ... for internal testing and evaluation purposes, not in production". By default the engine offers NVIDIA models **only on /benchmark** (marked "testing only"). With `ALLOW_NVIDIA_PRODUCTION=true` they become the first designer choice for real decks (`engineV3.optInRoutes.nvidia`). **Risk, plainly:** that breaks NVIDIA's trial terms for a paid product; NVIDIA can cut the key off at any time without notice. If that happens the engine simply fails over to Gemini / OpenRouter / Gemma, so decks keep coming, but quality drops back. Fine for a small beta; for a real launch use Ollama Cloud or another paid route for the designer.
* **Ollama Cloud — paid, optional, later** (docs.ollama.com/cloud, ollama.com/pricing, checked 31 Oct 2026). Dormant unless `OLLAMA_API_KEY` is set: hosted models through an API key — no server, no download (`https://ollama.com/v1`, OpenAI-compatible). **Not free:** "Pay as you go — Pay per token for every cloud model", 3 requests at a time. Models include `deepseek-v4.1-flash`, `glm-5.3-flash`, `kimi-k2.6`, `kimi-k3`, `gemma4:31b`, `minimax-m3.1-flash`. Prices per million tokens are on ollama.com/pricing (off-peak half price for some models outside 12:00–18:00 UTC on weekdays). A 12-slide deck uses roughly 170k input + 150k output tokens, so DeepSeek / GLM Flash cost only a few rupees to tens of rupees per deck — the cheapest legit way to get near-Kimi quality. Ollama: "one account per person"; prompts "never logged or trained on".
* **Cloudflare Workers AI**: 10,000 Neurons/day free, shared by all models (≈15–20 slide designs with gpt-oss-120b, or ≈170 FLUX.1 schnell images at 4 steps, or ≈95 FLUX.2 klein 4B images). Kimi and GLM on Workers AI need a paid plan.

### AI images (Nov 2026)

| Plan | Model | Input | Size | ≈ neurons / image | ≈ images / day free |
|---|---|---|---|---|---|
| Basic, Standard | `@cf/black-forest-labs/flux-1-schnell` | JSON, 4 steps | 1024×1024 | 58 | ~170 |
| Advanced | `@cf/black-forest-labs/flux-2-klein-4b` | multipart/form-data (prompt, width, height; steps fixed at 4) | sized to the template's photo slot, long side 1024 (16:9 cover → 1024×576, photo-split → 800×1024) | 104 | ~95 |

* No other image model (SDXL removed). When an AI image fails, Cloudflare says the day's allowance is used (429 / 4006), or the Advanced text check sees lettering in it, the slot gets a real attributed photo.
* Prompts (Advanced, `slidePrompt` in `src/engine-v3/assets/images.ts`): the subject with quoted titles and words like "slide"/"title" removed (they make the model paint garbled lettering), the slot's composition, and "no writing anywhere".
* Daily counter (`src/engine-v3/assets/imageBudget.ts`): one `[ai-image]` server-log line per image (model, size, slide, seconds, ≈neurons, today's total) and `aiImages` in `/api/health`. Limits: `CF_IMAGE_DAILY_LIMIT` (images, default 90), `CF_NEURON_DAILY_LIMIT` (default 9500), `V3_AI_IMAGES_PER_DECK` (default 6). Day resets 00:00 UTC (5:30 AM IST).

**Use the benchmark** (`/benchmark`, set `BENCHMARK_PASSWORD`) to run the same topic through several models for one role on *your* keys. It shows QA score, clean-slide count, time and the slides side by side, so you can reorder `engineV3.roles`.

**Waste cuts (no design calls removed):** research results are cached per topic for 7 days (`V3_RESEARCH_CACHE_DAYS`, `V3_RESEARCH_CACHE=off`). The same source query is never fetched twice. Vision QA runs only on slides whose DOM checks found a problem, plus the title slide (`V3_VISION_QA=smart` default; `always` / `off`). A slide that passed is never re-checked.

**Design recipe library** (`src/engine-v3/design/recipes.ts`): 38 hand-made example slides (title, agenda, definition, annotated photo, processes, cycle, comparisons, table, pros/cons, stats, chart, timelines, quote, image-led, architecture, hub, formula, applications, code, objectives, problem→solution, conclusions, closings). For every slide the engine picks 2–3 relevant ones and shows them to the designer AI as *inspiration* (technique, not layout). The designer still designs every slide itself. There is no fixed fallback layout any more: a slide that keeps breaking gets a fresh AI redesign. The only engine-made slide is an exact reference list, used if the AI's references slide drops a citation.

**Recipes A/B (31 Oct 2026, Gemma 4 26B for every role, same topic "Smart Library Management System", same cached research, one run each):** recipes ON → 2278 s, 128 AI calls (53 retried), 275k input tokens, 5/13 slides clean, outside judge 7.0/10; recipes OFF → 1326 s, 86 AI calls (27 retried), 166k input tokens, 11/13 clean, judge 7.2/10. With a small free model the recipe examples make every design prompt ~65% longer, which runs into Gemma's free 16,000 input tokens/minute and leaves more slides broken. So when your decks are mostly designed by Gemma (Gemini Flash daily limits used up), set `DESIGN_RECIPES=off`. Keep them on for stronger designers (Kimi / Gemini Flash / DeepSeek) — not re-tested with those yet; use /benchmark to check on your keys.


### Free capacity math (how many decks a free setup can make per day)

Measured AI calls per deck (engine v3, Oct 2026): a 12-slide deck = **about 50–80 calls**: ~3 small (brief, research, outline), 1–2 art direction, **25–45 slide designs** (12 first drafts + redesigns of slides that fail checks) and **10–25 vision checks**. Weaker designers need more redesigns, so they use *more* calls, not fewer. Slide images (Flux) are extra, ~5 per deck.

Free limits per ONE account per provider (provider pages / their own 429 replies, checked 30–31 Oct 2026):

| Provider (free) | Daily limit | What it covers | Decks/day it can carry |
|---|---|---|---|
| Google AI Studio — Gemini Flash (3.8, 3.7, 3.6, 3.5, 3-preview) | **20 requests/day per model**, per Google project | best free designer | 5 models × 20 = 100 strong calls → **~2 decks** designed on Gemini |
| Google AI Studio — Flash-Lite (3.5, 3.1) | ~500/day per model | brief / research / outline / vision | small roles for 100+ decks |
| Google AI Studio — Gemma 4 31B / 26B | high daily limit, but 16k input tokens/min and many HTTP 500/503 "high demand" replies (31 Oct test: ~half of 31B calls failed) | backup designer | a deck takes 60–90 min; a few per day in practice |
| OpenRouter `:free` (Gemma 4, Nemotron, Inkling…) | **50 requests/day per account** (all free models together), 20/min | backup designer + vision | **< 1 deck** |
| OpenRouter `:free` after buying ≥10 credits once | **1,000 requests/day**, 20/min | designer + vision | **~15–20 decks** (20/min ≈ one deck every few minutes) |
| Groq free — gpt-oss-120b / qwen3.8-27b | 1,000 requests/day, 30/min, but **8,000 tokens/min** | small roles (a design request is too big for 8k TPM) | small roles for ~200 decks |
| Cloudflare Workers AI | 10,000 Neurons/day | Flux images + last-resort text | images for ~30–40 decks |
| NVIDIA build.nvidia.com | rate limits not published (users report ~40/min) | /benchmark; production only with `ALLOW_NVIDIA_PRODUCTION=true` (trial terms risk) | many while the key lasts |
| Ollama Cloud (paid per token) | 3 requests at a time | strong designer | as many as you pay for |

**What this means:** with one free account on each provider and no credits, expect **about 2 high-quality (Gemini-designed) decks per day**, then the engine continues on Gemma 4 / OpenRouter free at lower quality and much slower. The single biggest legit step up is buying OpenRouter credits once (≥10) → 1,000 free-model requests/day → roughly **15–20 more decks/day** on the free Nemotron / Inkling / Gemma models. Beyond that, the designer step needs a paid model (Gemini Flash on a billed Google project, or a cheap paid model on OpenRouter) — the other roles can stay free. Do **not** multiply free accounts of the same provider: it breaks their terms and a ban takes the whole site down.

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
