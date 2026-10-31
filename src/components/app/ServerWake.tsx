"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * The free server sleeps after 15 idle minutes and takes ~30-60 s to wake. Starting a cheap /api/health request as
 * soon as a page opens gets that wake-up going while the visitor reads or signs in.
 */
let wakePromise: Promise<boolean> | null = null;
export function wakeServer(): Promise<boolean> {
  wakePromise ||= (async () => {
    for (let i = 0; i < 6; i++) {
      try {
        const r = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
        if (r.ok) return true;
      } catch {
        /* still waking — try again */
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
    return false;
  })();
  return wakePromise;
}

/** Landing: fire-and-forget pre-wake. Renders nothing. */
export function PreWake() {
  useEffect(() => {
    void wakeServer();
  }, []);
  return null;
}

/** /create: a quiet note while the server is still waking (shown only if it takes longer than ~3 s). */
export function WakeNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let done = false;
    const t = setTimeout(() => !done && setSlow(true), 3000);
    wakeServer().then(() => {
      done = true;
      clearTimeout(t);
      setSlow(false);
    });
    return () => clearTimeout(t);
  }, []);
  if (!slow) return null;
  return (
    <div role="status" aria-live="polite" className="glass rise mx-auto mb-6 flex max-w-[600px] items-center gap-3 rounded-[var(--r-md)] px-4 py-3 text-[14px] text-[var(--muted)]">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
      <span>
        <span className="font-medium text-[var(--ink)]">Waking up the server…</span> it\'s a free server, so the first load can take 30-60 seconds. You can fill in the form meanwhile.
      </span>
    </div>
  );
}
