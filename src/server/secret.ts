import crypto from "crypto";

declare global {
  var __deckcraftSecret: string | undefined;
}

/** Server signing secret (APP_SECRET). Falls back to a per-process random value (tokens then die on restart). */
export function appSecret(): string {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  if (!globalThis.__deckcraftSecret) {
    globalThis.__deckcraftSecret = crypto.randomBytes(32).toString("hex");
    console.warn("[secret] APP_SECRET is not set — using a temporary secret (signed links stop working after a restart)");
  }
  return globalThis.__deckcraftSecret;
}

export function sign(payload: string): string {
  return crypto.createHmac("sha256", appSecret()).update(payload).digest("base64url");
}

/** token = base64url(json).sig ; verify returns the payload when valid and not expired */
export function makeToken(data: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readToken<T = any>(token: string): (T & { exp: number }) | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expect = sign(body);
  if (expect.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!d.exp || d.exp < Date.now() / 1000) return null;
    return d;
  } catch {
    return null;
  }
}
