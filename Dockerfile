# DeckCraft AI — Docker image for a Hugging Face Space (Docker SDK) or any container host.
# Chromium (via Playwright) renders every slide; Noto fonts cover Hindi/Devanagari and other scripts.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7860 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DECKCRAFT_DATA_DIR=/data/deckcraft

# Fonts: Devanagari + wide Unicode coverage for PDF/PPTX rendering (Google Fonts are also loaded online).
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-noto-core fonts-noto-ui-core fonts-noto-extra fonts-indic fonts-dejavu-core fontconfig \
    && fc-cache -f && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
# NEXT_PUBLIC_* values are read on the server at request time (/api/me), so the image works without them.
# Hosts that pass env vars as Docker build args (Render, HF Space variables) also get them inlined at build;
# empty ones are unset first so an empty build arg never bakes in "" over the runtime value.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do [ -n "$(printenv "$v")" ] || unset "$v"; done; \
    npm run build && npm prune --omit=dev && npm cache clean --force

# Hugging Face runs the container as uid 1000; /data is the persistent disk when enabled (else ephemeral).
RUN mkdir -p /data/deckcraft && chown -R 1000:1000 /data /app
USER 1000

EXPOSE 7860
# Listens on $PORT when the host sets one (Render), else 7860 (Hugging Face).
CMD ["sh", "-c", "exec ./node_modules/.bin/next start -p ${PORT:-7860} -H 0.0.0.0"]
