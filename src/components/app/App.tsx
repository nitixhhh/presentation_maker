"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import CreateForm, { type CreateRequest } from "./CreateForm";
import ProgressView from "./ProgressView";
import DeckView from "./DeckView";
import { useJob } from "./useJob";
import type { DeckSummary, JobView } from "./types";
import { apiHeaders, forgetJob, saveJob, savedJobs, type SavedJob } from "@/lib/client/store";

type View = { name: "home" } | { name: "decks" } | { name: "job"; id: string };

function readView(): View {
  if (typeof window === "undefined") return { name: "home" };
  const q = new URLSearchParams(window.location.search);
  const job = q.get("job");
  if (job && /^[a-z0-9-]{6,64}$/i.test(job)) return { name: "job", id: job };
  if (q.get("view") === "decks") return { name: "decks" };
  return { name: "home" };
}

export default function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // reopening the app: resume the job in the URL, else the newest unfinished job of this browser
    const v = readView();
    if (v.name === "home") {
      const pending = savedJobs()[0];
      if (pending && Date.now() - Date.parse(pending.createdAt) < 30 * 60 * 1000) {
        fetch(`/api/v3/jobs/${pending.id}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.job && (d.job.status === "queued" || d.job.status === "running")) go({ name: "job", id: pending.id }, true);
          })
          .catch(() => {});
      }
    }
    setView(v);
    const onPop = () => setView(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((v: View, replace = false) => {
    const url = v.name === "job" ? `/?job=${v.id}` : v.name === "decks" ? "/?view=decks" : "/";
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const start = async (r: CreateRequest | Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v3/jobs", { method: "POST", headers: apiHeaders(), body: JSON.stringify(r) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job) throw new Error(data.error || "Could not start. Please check your internet and try again.");
      saveJob({ id: data.job.id, topic: String((r as CreateRequest).topic), createdAt: data.job.createdAt, request: r as Record<string, unknown> });
      go({ name: "job", id: data.job.id });
    } catch (e: any) {
      setError(e?.message === "Failed to fetch" ? "No internet connection. Please try again." : e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-5 pb-12">
      <header className="sticky top-0 z-10 -mx-5 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)]/90 px-5 py-3.5 backdrop-blur">
        <button onClick={() => go({ name: "home" })} className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ink)] text-[13px] font-bold tracking-tight text-white">DC</span>
          <span className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">DeckCraft</span>
        </button>
        <nav className="flex items-center gap-1">
          <button onClick={() => go({ name: "decks" })} className={`rounded-lg px-3 py-2 text-[14px] font-medium ${view.name === "decks" ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
            My decks
          </button>
          {view.name !== "home" && (
            <button onClick={() => go({ name: "home" })} aria-label="New deck" className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-2 text-[14px] font-medium text-white">
              <Plus className="h-4 w-4" /> New
            </button>
          )}
        </nav>
      </header>

      <main className="flex-1 pt-6">
        {view.name === "home" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-[var(--ink)]">Presentations for your class, researched and designed.</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Real sources with references, slides designed one by one, ready as PDF and editable PowerPoint.</p>
            </div>
            <CreateForm onSubmit={start} busy={busy} error={error} />
            <RecentDecks onOpen={(id) => go({ name: "job", id })} limit={3} onAll={() => go({ name: "decks" })} />
          </div>
        )}
        {view.name === "decks" && (
          <div className="space-y-4">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">My decks</h1>
            <RecentDecks onOpen={(id) => go({ name: "job", id })} />
          </div>
        )}
        {view.name === "job" && <JobScreen id={view.id} onHome={() => go({ name: "home" })} onRetry={start} />}
      </main>
    </div>
  );
}

function JobScreen({ id, onHome, onRetry }: { id: string; onHome: () => void; onRetry: (r: Record<string, unknown>) => void }) {
  const { job, link, missing } = useJob(id);
  const [deck, setDeck] = useState<DeckSummary | null>(null);

  useEffect(() => {
    if (job?.status === "done" && job.deckId && !deck) {
      let tries = 0;
      const load = () =>
        fetch(`/api/v3/deck/${job.deckId}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then(setDeck)
          .catch(() => {
            if (++tries < 20) setTimeout(load, 3000);
          });
      load();
    }
  }, [job?.status, job?.deckId, deck]);

  useEffect(() => {
    // keep the topic in "My decks" even if the deck was opened from a shared link
    if (job && !savedJobs().some((s) => s.id === job.id)) saveJob({ id: job.id, topic: job.topic, createdAt: job.createdAt });
  }, [job]);

  if (missing)
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-[16px] font-medium text-[var(--ink)]">This deck was not found.</p>
        <button onClick={onHome} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-white">
          Make a new deck
        </button>
      </div>
    );
  if (job?.status === "done")
    return deck ? (
      <DeckView deck={deck} />
    ) : (
      <div className="flex flex-col items-center gap-3 py-24 text-[var(--muted)]">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-[14px]">Opening your deck</span>
      </div>
    );
  const saved = savedJobs().find((s) => s.id === id);
  return <ProgressView job={job} link={link} onHome={onHome} onRetry={saved?.request ? () => onRetry(saved.request!) : undefined} />;
}

function RecentDecks({ onOpen, limit, onAll }: { onOpen: (id: string) => void; limit?: number; onAll?: () => void }) {
  const [saved, setSaved] = useState<SavedJob[] | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobView>>({});

  useEffect(() => {
    const s = savedJobs();
    setSaved(s);
    if (!s.length) return;
    let stop = false;
    const load = () =>
      fetch(`/api/v3/jobs?ids=${s.map((x) => x.id).join(",")}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (stop) return;
          const m: Record<string, JobView> = {};
          for (const j of d.jobs || []) m[j.id] = j;
          setJobs(m);
          if ((d.jobs || []).some((j: JobView) => j.status === "queued" || j.status === "running")) setTimeout(load, 5000);
        })
        .catch(() => !stop && setTimeout(load, 8000));
    load();
    return () => {
      stop = true;
    };
  }, []);

  if (!saved) return null;
  if (!saved.length) return limit ? null : <p className="py-10 text-center text-[15px] text-[var(--muted)]">Decks you create on this phone will appear here.</p>;
  const list = limit ? saved.slice(0, limit) : saved;

  return (
    <section className="space-y-2.5">
      {limit && (
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Recent</h2>
          {saved.length > limit && (
            <button onClick={onAll} className="text-[14px] font-medium text-[var(--accent)]">
              See all
            </button>
          )}
        </div>
      )}
      <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        {list.map((s) => {
          const j = jobs[s.id];
          const status = !j ? "" : j.status === "done" ? "Ready" : j.status === "failed" ? "Failed" : j.status === "queued" ? "In line" : `${Math.round(j.progress.percent)}%`;
          return (
            <li key={s.id} className="flex items-center">
              <button onClick={() => onOpen(s.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-[var(--ink)]">{j?.title || s.topic}</span>
                  <span className="block text-[13px] text-[var(--muted)]">{new Date(s.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                    j?.status === "done" ? "bg-[#E7F6EC] text-[#1B6B3A]" : j?.status === "failed" ? "bg-[#FDF2F2] text-[#9B1C1C]" : "bg-[var(--accent-soft)] text-[var(--accent)]"
                  }`}
                >
                  {status || "..."}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--faint)]" />
              </button>
              {!limit && (
                <button
                  aria-label="Remove from list"
                  onClick={() => {
                    forgetJob(s.id);
                    setSaved(savedJobs());
                  }}
                  className="px-3 py-3.5 text-[var(--faint)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
