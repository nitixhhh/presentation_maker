"use client";
import { useEffect, useRef, useState } from "react";
import type { JobView } from "./types";

export type LinkState = "live" | "polling" | "reconnecting";

/**
 * Follows one job. Server-Sent Events first; if the stream drops (phone sleeps, network blips,
 * proxy cuts it) it falls back to polling and quietly retries the stream. A running job never
 * turns into an error screen because of the network — only the server can say a job failed.
 */
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<JobView | null>(null);
  const [link, setLink] = useState<LinkState>("live");
  const [missing, setMissing] = useState(false);
  const jobRef = useRef<JobView | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let sseRetry: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const finished = () => jobRef.current?.status === "done" || jobRef.current?.status === "failed";
    const apply = (v: JobView) => {
      jobRef.current = v;
      setJob(v);
      failures = 0;
    };

    const poll = async () => {
      if (stopped || finished()) return;
      try {
        const r = await fetch(`/api/v3/jobs/${jobId}`, { cache: "no-store" });
        if (r.status === 404) {
          setMissing(true);
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        apply((await r.json()).job);
        if (!es) setLink("polling");
      } catch {
        failures++;
        setLink("reconnecting");
      }
      if (!stopped && !finished() && !es) pollTimer = setTimeout(poll, Math.min(15000, 2500 * Math.max(1, failures)));
    };

    const openStream = () => {
      if (stopped || finished() || typeof EventSource === "undefined") return;
      es?.close();
      es = new EventSource(`/api/v3/jobs/${jobId}/events`);
      es.addEventListener("job", (e) => {
        setLink("live");
        apply(JSON.parse((e as MessageEvent).data));
        if (finished()) {
          es?.close();
          es = null;
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped || finished()) return;
        setLink("reconnecting");
        poll(); // keep the screen fresh while the stream is down
        if (sseRetry) clearTimeout(sseRetry);
        sseRetry = setTimeout(openStream, 8000);
      };
    };

    const wake = () => {
      if (document.visibilityState === "visible" && !finished()) {
        if (pollTimer) clearTimeout(pollTimer);
        poll();
        if (!es) openStream();
      }
    };

    const offline = () => !finished() && setLink("reconnecting");
    poll();
    openStream();
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      stopped = true;
      es?.close();
      if (pollTimer) clearTimeout(pollTimer);
      if (sseRetry) clearTimeout(sseRetry);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("offline", offline);
    };
  }, [jobId]);

  return { job, link, missing };
}

export function formatDuration(sec?: number) {
  if (sec == null) return "";
  if (sec < 60) return "less than a minute";
  const m = Math.round(sec / 60);
  return m === 1 ? "about 1 minute" : `about ${m} minutes`;
}
