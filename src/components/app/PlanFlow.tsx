"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "@/lib/client/auth";
import type { JobView, PlanCard, PlanInfo, PlanStyle } from "./types";

/**
 * Advanced plan (engine v6), phone-first: PLAN (editable outline cards) → STYLE ("Surprise me" or three looks made for this topic,
 * each shown as this deck's own title slide + one content slide) → Generate. Nothing is designed before approval.
 */
const BEAT: Record<string, string> = { question: "Question", context: "Context", evidence: "Evidence", mechanism: "How it works", implication: "Implications", counterpoint: "Other side", answer: "Answer" };

export default function PlanFlow({ job, onStarted }: { job: JobView; onStarted: (jobId: string) => void }) {
  const plan = job.progress.plan as PlanInfo;
  const [step, setStep] = useState<"plan" | "style">("plan");
  const [cards, setCards] = useState<PlanCard[]>(() => plan.cards.map((c) => ({ ...c, points: [...c.points] })));
  const [styles, setStyles] = useState<PlanStyle[]>(plan.styles);
  const [mode, setMode] = useState<"surprise" | "choose">("surprise");
  const [styleId, setStyleId] = useState<string | null>(plan.styles[0]?.id || null);
  const [images, setImages] = useState<"real" | "ai" | "none">(plan.defaultImages || "real");
  const [busy, setBusy] = useState<"" | "more" | "go">("");
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const content = cards.filter((c) => !c.fixed);
  const update = (k: number, f: (c: PlanCard) => PlanCard) => setCards((cs) => cs.map((c, i) => (i === k ? f(c) : c)));
  const move = (k: number, d: -1 | 1) =>
    setCards((cs) => {
      const j = k + d;
      if (cs[k].fixed || !cs[j] || cs[j].fixed) return cs;
      const n = [...cs];
      [n[k], n[j]] = [n[j], n[k]];
      return n;
    });
  const remove = (k: number) => setCards((cs) => (cs.filter((c) => !c.fixed).length <= 2 ? cs : cs.filter((_, i) => i !== k)));
  const add = () =>
    setCards((cs) => {
      const at = cs.findIndex((c) => c.fixed === "references");
      const n = [...cs];
      n.splice(at < 0 ? cs.length : at, 0, { id: "", title: "", points: [""], layout: "New slide", sources: [] });
      setOpen(at < 0 ? cs.length : at);
      return n;
    });

  const more = async () => {
    setBusy("more");
    setErr(null);
    try {
      const r = await api(`/api/v3/jobs/${job.id}/styles`, { method: "POST", body: "{}" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.plan) throw new Error(d.error || "Could not make more styles.");
      setStyles(d.plan.styles);
      setStyleId(d.plan.styles[0]?.id || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const go = async () => {
    setBusy("go");
    setErr(null);
    try {
      const body = { cards: cards.map((c) => ({ ...c, points: c.points.map((p) => p.trim()).filter(Boolean) })), styleId: mode === "choose" ? styleId : null, imageMode: images === "ai" ? "ai-allowed" : images === "none" ? "none" : "real-first" };
      const r = await api(`/api/v3/jobs/${job.id}/approve`, { method: "POST", body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.job) throw new Error(d.error || "Could not start the deck.");
      onStarted(d.job.id);
    } catch (e: any) {
      setErr(e.message === "Failed to fetch" ? "No internet connection. Please try again." : e.message);
      setBusy("");
    }
  };

  if (step === "plan")
    return (
      <div className="space-y-4 pb-24">
        <div className="rise px-1">
          <span className="eyebrow">Step 1 of 2 · Your plan</span>
          <h2 className="display mt-2 text-[26px] leading-tight sm:text-[32px]">{job.title || job.topic}</h2>
          <p className="mt-2 text-[14.5px] leading-snug text-[var(--muted)]">Check the story before anything is designed. Tap a slide to change it, move it or remove it.</p>
        </div>
        <ol className="space-y-2.5">
          {cards.map((c, k) => {
            const isOpen = open === k;
            const num = k + 1;
            return (
              <li key={`${c.id || "new"}-${k}`} className={`panel rounded-[var(--r-lg)] ${isOpen ? "ring-2 ring-[var(--accent)]" : ""}`}>
                <button onClick={() => setOpen(isOpen ? null : k)} className="flex w-full items-start gap-3 px-4 pt-4 text-left" aria-expanded={isOpen}>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-semibold text-[var(--paper,#fffdf8)]">{num}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">
                      {c.fixed === "title" ? "Title slide" : c.fixed === "references" ? "References" : c.fixed === "closing" ? "Closing" : c.beat && BEAT[c.beat] ? BEAT[c.beat] : "Slide"}
                      {c.layout && !c.fixed ? <span className="font-medium normal-case tracking-normal">· {c.layout}</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[16px] font-semibold leading-snug text-[var(--ink)]">{c.title || <span className="text-[var(--muted)]">Untitled slide</span>}</span>
                  </span>
                </button>
                {!isOpen && (
                  <div className="px-4 pb-4 pl-[56px]">
                    {c.fixed === "references" ? (
                      <p className="mt-1 text-[13.5px] text-[var(--muted)]">Built from the real sources behind your slides.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1">
                        {c.points.slice(0, 4).map((p, i) => (
                          <li key={i} className="text-[14px] leading-snug text-[var(--ink)]/80 [overflow-wrap:anywhere]">
                            {p}
                          </li>
                        ))}
                        {c.points.length > 4 && <li className="text-[13px] text-[var(--muted)]">+{c.points.length - 4} more</li>}
                      </ul>
                    )}
                    {c.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.sources.map((s) => (
                          <span key={s} className="rounded-full border border-[var(--rule)] px-2.5 py-0.5 text-[12px] text-[var(--muted)]">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isOpen && (
                  <div className="space-y-3 px-4 pb-4 pt-3">
                    <label className="block">
                      <span className="label">Slide title</span>
                      <textarea value={c.title} rows={2} onChange={(e) => update(k, (x) => ({ ...x, title: e.target.value.slice(0, 140) }))} className="field resize-none" placeholder="What this slide shows, as one sentence" />
                    </label>
                    {c.fixed !== "references" && c.fixed !== "title" && (
                      <div className="space-y-2">
                        <span className="label">Points</span>
                        {c.points.map((p, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <textarea value={p} rows={2} onChange={(e) => update(k, (x) => ({ ...x, points: x.points.map((q, j) => (j === i ? e.target.value.slice(0, 300) : q)) }))} className="field flex-1 resize-none !py-2 text-[14px]" />
                            <button onClick={() => update(k, (x) => ({ ...x, points: x.points.filter((_, j) => j !== i) }))} aria-label="Remove point" className="press mt-1 rounded-full p-2 text-[var(--muted)]">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {c.points.length < 7 && (
                          <button onClick={() => update(k, (x) => ({ ...x, points: [...x.points, ""] }))} className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--accent-ink)]">
                            <Plus className="h-4 w-4" /> Add a point
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      {!c.fixed && (
                        <>
                          <button onClick={() => move(k, -1)} disabled={!!cards[k - 1]?.fixed} aria-label="Move up" className="press panel rounded-full p-2.5 disabled:opacity-30">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button onClick={() => move(k, 1)} disabled={!cards[k + 1] || !!cards[k + 1]?.fixed} aria-label="Move down" className="press panel rounded-full p-2.5 disabled:opacity-30">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => { remove(k); setOpen(null); }} disabled={content.length <= 2} className="press ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium text-[var(--bad)] disabled:opacity-30">
                            <Trash2 className="h-4 w-4" /> Delete slide
                          </button>
                        </>
                      )}
                      <button onClick={() => setOpen(null)} className={`btn btn-ghost btn-sm ${c.fixed ? "ml-auto" : ""}`}>
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <button onClick={add} disabled={cards.length >= 20} className="press panel flex w-full items-center justify-center gap-2 rounded-[var(--r-lg)] py-3.5 text-[15px] font-medium text-[var(--ink)] disabled:opacity-40">
          <Plus className="h-4 w-4" /> Add a slide
        </button>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule)] bg-[var(--paper,#fffdf8)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-[820px]">
            <button onClick={() => { setOpen(null); setStep("style"); window.scrollTo({ top: 0 }); }} className="btn btn-ink w-full">
              Looks good, choose a style
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-5 pb-24">
      <div className="rise px-1">
        <button onClick={() => setStep("plan")} className="mb-2 text-[14px] font-medium text-[var(--accent-ink)]">
          Back to the plan
        </button>
        <span className="eyebrow block">Step 2 of 2 · Look and feel</span>
        <h2 className="display mt-2 text-[26px] leading-tight sm:text-[32px]">How should it look?</h2>
      </div>
      <div className="flex gap-1 rounded-full bg-[rgba(29,25,19,.06)] p-1" role="radiogroup">
        {(
          [
            ["surprise", "Surprise me"],
            ["choose", "Choose"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`press flex-1 rounded-full py-2.5 text-[14.5px] font-medium transition-colors ${mode === k ? "bg-[var(--card)] text-[var(--ink)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)]"}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === "surprise" ? (
        <div className="panel rounded-[var(--r-lg)] p-5">
          <p className="text-[15.5px] font-semibold text-[var(--ink)]">The designer picks a look made for this topic.</p>
          <p className="mt-1 text-[14px] leading-snug text-[var(--muted)]">Colours, fonts and background are designed for “{job.title || job.topic}”. Text colours are checked so every word is easy to read.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="px-1 text-[14px] text-[var(--muted)]">Three looks made for this topic, shown on your own slides.</p>
          {styles.map((s) => {
            const on = styleId === s.id;
            return (
              <button key={s.id} onClick={() => setStyleId(s.id)} role="radio" aria-checked={on} className={`press panel block w-full overflow-hidden rounded-[var(--r-lg)] text-left ${on ? "ring-2 ring-[var(--accent)]" : ""}`}>
                {/* this deck's own title slide, big, with one content slide beside it on wider screens */}
                <div className="grid grid-cols-1 gap-1.5 bg-[#1d1913]/5 p-1.5 sm:grid-cols-2">
                  {s.previews.slice(0, 2).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`${s.name}: ${i ? "a content slide" : "your title slide"}`} loading="lazy" className="aspect-video w-full rounded-[8px] object-cover" />
                  ))}
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--rule-2)]"}`}>{on && <Check className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold text-[var(--ink)]">{s.name}</span>
                    {s.why && <span className="mt-0.5 block text-[13.5px] leading-snug text-[var(--muted)]">{s.why}</span>}
                  </span>
                  <span className="flex shrink-0 gap-1 pt-1">
                    {["bg", "primary", "accent", "accent2"].map((k) => (
                      <span key={k} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: s.palette[k] }} />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
          <button onClick={more} disabled={!!busy || styles.length >= 12} className="press panel flex w-full items-center justify-center gap-2 rounded-[var(--r-lg)] py-3.5 text-[15px] font-medium text-[var(--ink)] disabled:opacity-40">
            {busy === "more" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {busy === "more" ? "Designing three more looks" : "Suggest another"}
          </button>
        </div>
      )}
      <div className="panel space-y-2.5 rounded-[var(--r-lg)] p-4">
        <span className="label">Images</span>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
          {(
            [
              ["real", "Real photos"],
              ["ai", "AI images"],
              ["none", "No images"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={images === k} onClick={() => setImages(k)} className={`rounded-[10px] border px-2 py-2.5 text-[13.5px] font-medium transition-colors ${images === k ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper,#fffdf8)]" : "border-[var(--rule)] text-[var(--ink)]"}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] leading-snug text-[var(--muted)]">
          {images === "real" ? "Free photos from Wikimedia Commons, checked to match each slide." : images === "ai" ? "AI images use a free daily allowance; real photos are used when it runs out." : "Only typography, icons, charts and diagrams."}
        </p>
      </div>
      {err && <p className="px-1 text-[14px] text-[var(--bad)]">{err}</p>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule)] bg-[var(--paper,#fffdf8)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[820px]">
          <button onClick={go} disabled={!!busy || (mode === "choose" && !styleId)} className="btn btn-ink w-full">
            {busy === "go" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Generate my {content.length + cards.filter((c) => c.fixed).length}-slide deck
          </button>
        </div>
      </div>
    </div>
  );
}
