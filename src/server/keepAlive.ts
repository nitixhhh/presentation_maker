/**
 * In-job keep-alive for hosts that sleep an idle service (Render free: 15 min with no inbound HTTP).
 *
 * While at least one deck job is queued or running, the server pings its OWN public URL
 * (PUBLIC_SITE_URL + /api/health) every KEEPALIVE_INTERVAL_MIN minutes (default 4). The request goes
 * out through the host's edge and back in, which counts as inbound traffic, so the instance is not put
 * to sleep in the middle of a deck. When no job is active the timer stops, so an idle site still sleeps
 * (Render's free instance-hours are shared by every service in the workspace — no always-on pinger here).
 *
 * KEEPALIVE=off disables it. Nothing happens when PUBLIC_SITE_URL is not set (local dev).
 */

declare global {
  var __deckcraftKeepAlive: { timer: NodeJS.Timeout | null; active: number; lastPingAt?: number; lastStatus?: number | string; pings: number } | undefined;
}

const K = globalThis.__deckcraftKeepAlive || (globalThis.__deckcraftKeepAlive = { timer: null, active: 0, pings: 0 });

export function keepAliveUrl(): string | null {
  if (process.env.KEEPALIVE === "off") return null;
  const base = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return null;
  return `${base}/api/health?keepalive=1`;
}

export function keepAliveIntervalMs(): number {
  const min = Number(process.env.KEEPALIVE_INTERVAL_MIN || 4);
  return Math.round(Math.min(Math.max(Number.isFinite(min) ? min : 4, 1), 14) * 60_000);
}

async function ping(url: string, fetchImpl: typeof fetch = fetch) {
  try {
    const res = await fetchImpl(url, { cache: "no-store", headers: { "user-agent": "deckcraft-keepalive" }, signal: AbortSignal.timeout(20_000) });
    K.lastStatus = res.status;
    await res.arrayBuffer().catch(() => undefined);
  } catch (e: any) {
    K.lastStatus = String(e?.name || e).slice(0, 60);
  }
  K.lastPingAt = Date.now();
  K.pings++;
}

/** Tell the keep-alive how many jobs are queued or running right now; starts/stops the timer. */
export function setActiveJobs(n: number, deps: { fetchImpl?: typeof fetch; setIntervalImpl?: typeof setInterval; clearIntervalImpl?: typeof clearInterval } = {}) {
  K.active = Math.max(0, n | 0);
  const url = keepAliveUrl();
  const si = deps.setIntervalImpl || setInterval;
  const ci = deps.clearIntervalImpl || clearInterval;
  if (K.active > 0 && url && !K.timer) {
    K.timer = si(() => {
      if (K.active > 0) void ping(url, deps.fetchImpl);
    }, keepAliveIntervalMs());
    (K.timer as any)?.unref?.();
    console.log(`[keepalive] on — ${K.active} active job(s), ping every ${Math.round(keepAliveIntervalMs() / 60000)} min`);
  } else if ((K.active === 0 || !url) && K.timer) {
    ci(K.timer);
    K.timer = null;
    console.log(`[keepalive] off — no active jobs (${K.pings} pings sent)`);
  }
}

export function keepAliveState() {
  return { on: !!K.timer, activeJobs: K.active, pings: K.pings, lastPingAt: K.lastPingAt ? new Date(K.lastPingAt).toISOString() : null, lastStatus: K.lastStatus ?? null };
}
