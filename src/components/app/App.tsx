"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Trash2, LogOut, Gift } from "lucide-react";
import { WakeNotice } from "./ServerWake";
import { Wordmark } from "@/components/brand/Brand";
import Gallery from "./Gallery";
import CreateForm, { AGE_KEY, type CreateRequest } from "./CreateForm";
import ProgressView from "./ProgressView";
import DeckView from "./DeckView";
import PlanFlow from "./PlanFlow";
import { useJob } from "./useJob";
import type { DeckSummary, JobView } from "./types";
import { forgetJob, keepOnly, saveJob, savedJobs, type SavedJob } from "@/lib/client/store";
import { api, authReady, claimReferralIfAny, rememberReferral, signInWithGoogle, signOut, useMe, type Me } from "@/lib/client/auth";

const PENDING_KEY = "deckcraft.pending.v1";

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
  const { me, refresh } = useMe();

  useEffect(() => {
    rememberReferral();
  }, []);

  // after Google sign-in: claim a friend's referral, then start the deck the visitor was about to make
  useEffect(() => {
    if (!me?.user) return;
    claimReferralIfAny().then(refresh);
    const p = sessionStorage.getItem(PENDING_KEY);
    if (p) {
      sessionStorage.removeItem(PENDING_KEY);
      try {
        start(JSON.parse(p));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.user?.id]);

  useEffect(() => {
    // reopening the app: resume the job in the URL, else the newest unfinished job of this browser
    const v = readView();
    if (v.name === "home") {
      // read the list of whoever is signed in on this browser (known only after the login state loads)
      authReady().then(() => {
        const pending = savedJobs()[0];
        if (!pending || Date.now() - Date.parse(pending.createdAt) >= 30 * 60 * 1000) return;
        api(`/api/v3/jobs/${pending.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.job && (d.job.status === "queued" || d.job.status === "running") && readView().name === "home") go({ name: "job", id: pending.id }, true);
          })
          .catch(() => {});
      });
    }
    setView(v);
    const onPop = () => setView(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((v: View, replace = false) => {
    const url = v.name === "job" ? `/create?job=${v.id}` : v.name === "decks" ? "/create?view=decks" : "/create";
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const start = async (r: CreateRequest | Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    if (me?.auth.required && !me.user) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(r));
      await signInWithGoogle().catch((e) => setError(e.message));
      setBusy(false);
      return;
    }
    try {
      const ageOk = (r as CreateRequest).ageConfirmed === true || localStorage.getItem(AGE_KEY) === "1";
      const res = await api("/api/v3/jobs", { method: "POST", body: JSON.stringify({ ...r, ageConfirmed: ageOk }) });
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
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 px-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
        <div className="glass mx-auto flex h-[56px] max-w-[880px] items-center justify-between gap-2 rounded-full pl-4 pr-2 sm:pl-5">
          <Link href="/" aria-label="DeckCraft home" className="press shrink-0">
            <Wordmark compact={view.name !== "home"} />
          </Link>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => go({ name: "decks" })}
              className={`press whitespace-nowrap rounded-full px-3 py-2 text-[14px] font-medium ${view.name === "decks" ? "bg-[rgba(29,25,19,.06)] text-[var(--ink)]" : "text-[var(--muted)]"}`}
            >
              My decks
            </button>
            {view.name !== "home" && (
              <button onClick={() => go({ name: "home" })} aria-label="New deck" className="btn btn-ink btn-sm !gap-1 !px-3.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}
            <Account me={me} onChange={refresh} />
          </nav>
        </div>
      </header>

      <main key={view.name === "job" ? view.id : view.name} className={`mx-auto w-full flex-1 px-4 pb-14 pt-7 sm:px-5 sm:pt-12 ${view.name === "job" ? "max-w-[820px]" : "max-w-[600px]"}`}>
        <WakeNotice />
        {view.name === "home" && (
          <div className="space-y-9">
            <div className="rise px-1 text-center sm:text-left">
              <span className="eyebrow">New deck</span>
              <h1 className="display mt-2.5 text-[36px] sm:text-[48px]">
                Give a topic, <span className="accent-serif">get a deck.</span>
              </h1>
              <p className="lede mt-2.5 text-[15.5px]">Real sources with references, every slide designed on its own, and both PDF and editable PowerPoint.</p>
            </div>
            <div className="glass rise d1 rounded-[var(--r-xl)] p-4 sm:p-6">
              <CreateForm onSubmit={start} busy={busy} error={error} plans={me?.engine?.canChoose ? me.engine.plans || [] : []} plansPublic={!!me?.engine?.plansPublic} engineDefault={me?.engine?.default || "v3"} />
            </div>
            {me?.auth.required && !me.user && <p className="-mt-6 text-center text-[13px] text-[var(--muted)]">You'll sign in with Google before the deck starts.</p>}
            {me && <RecentDecks key={me.user?.id || "anon"} onOpen={(id) => go({ name: "job", id })} limit={3} onAll={() => go({ name: "decks" })} signedIn={!!me.user} />}
            <Gallery />
          </div>
        )}
        {view.name === "decks" && (
          <div className="rise space-y-5">
            <h1 className="display px-1 text-[34px]">My decks</h1>
            {me && <RecentDecks key={me.user?.id || "anon"} onOpen={(id) => go({ name: "job", id })} signedIn={!!me.user} />}
            {me?.user && me.referralCode && <Invite me={me} />}
          </div>
        )}
        {view.name === "job" && (
          <JobScreen
            id={view.id}
            me={me}
            onHome={() => go({ name: "home" })}
            onRetry={start}
            onOpenJob={(id) => {
              const s = savedJobs().find((x) => x.id === view.id);
              saveJob({ id, topic: s?.topic || "", createdAt: new Date().toISOString(), request: s?.request });
              go({ name: "job", id });
            }}
          />
        )}
      </main>
    </div>
  );
}

function JobScreen({ id, me, onHome, onRetry, onOpenJob }: { id: string; me: Me | null; onHome: () => void; onRetry: (r: Record<string, unknown>) => void; onOpenJob: (id: string) => void }) {
  const { job, link, missing } = useJob(id);
  const [deck, setDeck] = useState<DeckSummary | null>(null);
  const [reload, setReload] = useState(0);
  const onReload = useCallback(() => setReload((x) => x + 1), []);

  useEffect(() => {
    if (job?.status === "done" && job.deckId && job.stage !== "plan") {
      let tries = 0;
      const load = () =>
        api(`/api/v3/deck/${job.deckId}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then(setDeck)
          .catch(() => {
            if (++tries < 20) setTimeout(load, 3000);
          });
      load();
    }
  }, [job?.status, job?.deckId, reload]);

  useEffect(() => {
    // keep the topic in "My decks" even if the deck was opened from a shared link
    // (into the list of whoever is signed in here — known once the login state has loaded)
    if (job)
      authReady().then(() => {
        if (!savedJobs().some((s) => s.id === job.id)) saveJob({ id: job.id, topic: job.topic, createdAt: job.createdAt });
      });
  }, [job]);

  if (missing)
    return (
      <div className="panel rise space-y-5 rounded-[var(--r-lg)] px-6 py-14 text-center">
        <p className="text-[17px] font-medium text-[var(--ink)]">This deck was not found.</p>
        <button onClick={onHome} className="btn btn-ink">
          Make a new deck
        </button>
      </div>
    );
  // engine v6: the plan is ready — the student edits and approves it, then picks a style
  if (job?.status === "done" && job.stage === "plan" && job.progress.plan) return <PlanFlow job={job} onStarted={onOpenJob} />;
  if (job?.status === "done")
    return deck ? (
      <DeckView deck={deck} me={me} onReload={onReload} />
    ) : (
      <div className="flex flex-col items-center gap-3 py-24 text-[var(--muted)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        <span className="text-[14px]">Opening your deck</span>
      </div>
    );
  const saved = savedJobs().find((s) => s.id === id);
  return <ProgressView job={job} link={link} onHome={onHome} onRetry={saved?.request ? () => onRetry(saved.request!) : undefined} />;
}

function RecentDecks({ onOpen, limit, onAll, signedIn }: { onOpen: (id: string) => void; limit?: number; onAll?: () => void; signedIn?: boolean }) {
  const [saved, setSaved] = useState<SavedJob[] | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobView>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (f: () => void, ms: number) => {
      if (!stop) timer = setTimeout(f, ms);
    };
    const show = (list: JobView[]) => {
      const m: Record<string, JobView> = {};
      for (const j of list) m[j.id] = j;
      setJobs(m);
      return list.some((j) => j.status === "queued" || j.status === "running");
    };
    if (signedIn) {
      // signed in: exactly this account's decks, from the server (any device). Nothing from another
      // account or from the signed-out list on this phone is mixed in.
      const load = () =>
        api("/api/v3/jobs?mine=1")
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((d) => {
            if (stop) return;
            const list = ((d.jobs || []) as JobView[]).filter((j) => j.status !== "failed" || Date.now() - Date.parse(j.createdAt) < 86400_000);
            setSaved(list.map((j) => ({ id: j.id, topic: j.topic, createdAt: j.createdAt })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
            if (show(list)) later(load, 5000);
          })
          .catch(() => later(load, 8000));
      load();
    } else {
      // signed out: the decks made on this phone while signed out
      const s = savedJobs();
      setSaved(s);
      if (s.length) {
        const load = () =>
          api(`/api/v3/jobs?ids=${savedJobs().slice(0, 50).map((x) => x.id).join(",")}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => {
              if (stop || !Array.isArray(d.jobs)) return;
              keepOnly((d.jobs as JobView[]).map((j) => j.id)); // the server hides decks of any account
              setSaved(savedJobs());
              if (show(d.jobs)) later(load, 5000);
            })
            .catch(() => later(load, 8000));
        load();
      }
    }
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [signedIn]);

  if (!saved) return null;
  if (!saved.length)
    return limit ? null : (
      <p className="panel rounded-[var(--r-lg)] px-6 py-12 text-center text-[15px] text-[var(--muted)]">{signedIn ? "Decks from your account will show up here." : "Decks you make on this device will show up here."}</p>
    );
  const list = limit ? saved.slice(0, limit) : saved;

  return (
    <section className="space-y-2.5">
      {limit && (
        <div className="flex items-center justify-between px-1">
          <h2 className="eyebrow">Recent</h2>
          {saved.length > limit && (
            <button onClick={onAll} className="text-[14px] font-medium text-[var(--accent-ink)]">
              See all
            </button>
          )}
        </div>
      )}
      <ul className="panel divide-y divide-[var(--rule)] overflow-hidden rounded-[var(--r-lg)]">
        {list.map((s) => {
          const j = jobs[s.id];
          const status = !j ? "" : j.status === "done" && j.stage === "plan" ? "Plan ready" : j.status === "done" ? "Ready" : j.status === "failed" ? "Failed" : j.status === "queued" ? "In line" : `${Math.round(j.progress.percent)}%`;
          return (
            <li key={s.id} className="flex items-center">
              <button onClick={() => onOpen(s.id)} className="flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[rgba(29,25,19,.03)]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-[var(--ink)]">{j?.title || s.topic}</span>
                  <span className="block text-[13px] text-[var(--muted)]">{new Date(s.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                    j?.status === "done" ? "bg-[var(--ok-soft)] text-[var(--ok)]" : j?.status === "failed" ? "bg-[var(--bad-soft)] text-[var(--bad)]" : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  }`}
                >
                  {status || "..."}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--faint)]" />
              </button>
              {!limit && (
                <button
                  aria-label="Delete deck"
                  disabled={deleting === s.id}
                  onClick={async () => {
                    const busy = j && (j.status === "queued" || j.status === "running");
                    if (busy) return window.alert("This deck is still being made. You can delete it once it is finished.");
                    if (!window.confirm(`Delete "${j?.title || s.topic}"? This cannot be undone.`)) return;
                    setDeleting(s.id);
                    try {
                      const r = await api(`/api/v3/jobs/${s.id}`, { method: "DELETE" });
                      if (!r.ok && r.status !== 404) {
                        const d = await r.json().catch(() => ({}));
                        window.alert(d.error || "Could not delete the deck. Please try again.");
                        return;
                      }
                      forgetJob(s.id);
                      setSaved((cur) => (cur || []).filter((x) => x.id !== s.id));
                    } catch {
                      window.alert("No internet connection. Please try again.");
                    } finally {
                      setDeleting(null);
                    }
                  }}
                  className="px-3 py-3.5 text-[var(--faint)] transition-colors hover:text-[var(--bad)] disabled:opacity-40"
                >
                  {deleting === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Account({ me, onChange }: { me: Me | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  if (!me?.auth.configured) return null;
  if (!me.user)
    return (
      <button onClick={() => signInWithGoogle().catch(() => {})} className="btn btn-ghost btn-sm !px-3.5">
        Sign in
      </button>
    );
  const initial = (me.user.name || me.user.email || "?").trim()[0]?.toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account" className="press flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[14px] font-semibold text-[var(--accent-ink)] ring-2 ring-[rgba(255,255,255,.8)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {me.user.avatar ? <img src={me.user.avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initial}
      </button>
      {open && (
        <div className="glass menu pop absolute right-0 z-30 mt-3 w-64 space-y-1 rounded-[20px] p-4 text-[14px]" style={{ transformOrigin: "calc(100% - 20px) -12px" }}>
          <p className="truncate font-medium text-[var(--ink)]">{me.user.name || me.user.email}</p>
          <p className="text-[var(--muted)]">{me.credits} deck credit{me.credits === 1 ? "" : "s"}</p>
          <button
            onClick={async () => {
              await signOut();
              setOpen(false);
              onChange();
            }}
            className="mt-2 flex items-center gap-2 text-[var(--muted)]"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Invite({ me }: { me: Me }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${me.referralCode}` : "";
  const n = me.pricing.referralCredits;
  return (
    <div className="panel space-y-2.5 rounded-[var(--r-lg)] p-5">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--ink)]">
        <Gift className="h-4 w-4 text-[var(--accent)]" /> Invite a friend, get {n} free deck{n === 1 ? "" : "s"}
      </p>
      <p className="text-[14px] text-[var(--muted)]">When a friend signs up with your link, you get {n} deck credit{n === 1 ? "" : "s"}.</p>
      <button
        onClick={async () => {
          if (navigator.share) await navigator.share({ title: "DeckCraft", text: "Make your class presentation with DeckCraft", url: link }).catch(() => {});
          else {
            await navigator.clipboard.writeText(link).catch(() => {});
            setCopied(true);
          }
        }}
        className="btn btn-ink mt-1 w-full"
      >
        {copied ? "Link copied" : "Share my link"}
      </button>
    </div>
  );
}
