/** In-memory token-bucket rate limiter (per user / IP). Good for one server instance. */
const buckets = new Map<string, { tokens: number; at: number }>();

export function rateLimit(key: string, perMinute: number, burst = perMinute): boolean {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: burst, at: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 50_000) buckets.clear();
  return true;
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
}

export function tooMany() {
  return Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
}
