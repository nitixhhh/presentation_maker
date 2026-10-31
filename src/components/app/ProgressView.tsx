"use client";
import { Check, Loader2, Clock, WifiOff, RotateCcw } from "lucide-react";
import type { JobStage, JobView } from "./types";
import type { LinkState } from "./useJob";
import { formatDuration } from "./useJob";

const STEPS: { key: JobStage; label: string; hint: string }[] = [
  { key: "research", label: "Research", hint: "Reading real sources and collecting cited facts" },
  { key: "outline", label: "Outline", hint: "Planning the story slide by slide" },
  { key: "design", label: "Design", hint: "Designing every slide and choosing images" },
  { key: "qa", label: "Quality check", hint: "Checking each slide for layout and readability" },
  { key: "export", label: "Export", hint: "Building your PDF and PPTX" },
];
const RANK: Record<JobStage, number> = { queued: 0, research: 1, outline: 2, design: 3, qa: 4, export: 5, done: 6 };

export default function ProgressView({ job, link, onRetry, onHome }: { job: JobView | null; link: LinkState; onRetry?: () => void; onHome: () => void }) {
  if (!job)
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-[var(--muted)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        <span className="text-[14px]">Loading your deck</span>
      </div>
    );

  if (job.status === "failed")
    return (
      <div className="rise space-y-5 py-2">
        <div className="px-1">
          <span className="eyebrow">Not finished</span>
          <h2 className="display mt-2 text-[28px] sm:text-[34px]">{job.topic}</h2>
        </div>
        <div className="rounded-[var(--r-lg)] border border-[#EBC3B6] bg-[var(--bad-soft)] p-5">
          <p className="text-[15px] font-medium text-[var(--bad)]">This deck could not be finished.</p>
          <p className="mt-1 text-[14px] text-[var(--bad)]/80">{job.error}</p>
        </div>
        <div className="flex gap-3">
          {onRetry && (
            <button onClick={onRetry} className="btn btn-ink flex-1">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          )}
          <button onClick={onHome} className="btn btn-ghost flex-1">
            New deck
          </button>
        </div>
      </div>
    );

  const queued = job.status === "queued";
  const pct = Math.max(queued ? 0 : 2, Math.min(100, Math.round(job.progress.percent)));
  const rank = RANK[job.progress.stage];

  return (
    <div className="space-y-5 py-2">
      <div className="rise px-1">
        <span className="eyebrow">{queued ? "Waiting in line" : "Making your presentation"}</span>
        <h2 className="display mt-2 text-[28px] sm:text-[34px]">{job.topic}</h2>
      </div>

      <div className="glass rise d1 rounded-[var(--r-xl)] p-6">
        {queued ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
              <Clock className="h-5 w-5 text-[var(--accent)]" />
            </span>
            <div>
              <p className="text-[17px] font-semibold text-[var(--ink)]">
                {job.queuePosition === 1 ? "You are next" : `You are number ${job.queuePosition ?? "-"} in line`}
              </p>
              <p className="mt-0.5 text-[14px] text-[var(--muted)]">
                Other decks are being made right now. Your deck should be ready in {formatDuration(job.etaSeconds)}.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <span className="text-[56px] font-semibold leading-none tracking-[-0.05em] tabular-nums text-[var(--ink)]">
                {pct}
                <span className="text-[28px] text-[var(--muted)]">%</span>
              </span>
              <span className="pb-1 text-[14px] text-[var(--muted)]">{job.etaSeconds != null ? `${formatDuration(job.etaSeconds)} left` : ""}</span>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
              <div className="relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#c98a2e,var(--accent))] transition-[width] duration-[900ms] [transition-timing-function:var(--spring-soft)]" style={{ width: `${pct}%` }}>
                <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)] [animation:shimmer_1.8s_ease-in-out_infinite]" />
              </div>
            </div>
          </>
        )}
      </div>

      <ol className="panel rise d2 space-y-0.5 rounded-[var(--r-lg)] p-3 sm:p-4">
        {STEPS.map((s) => {
          const state = queued ? "todo" : rank > RANK[s.key] ? "done" : rank === RANK[s.key] ? "now" : "todo";
          return (
            <li key={s.key} className={`flex items-start gap-3.5 rounded-[14px] px-2.5 py-2.5 transition-colors ${state === "now" ? "bg-[rgba(243,230,207,.6)]" : ""}`}>
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  state === "done" ? "border-[var(--accent)] bg-[var(--accent)] text-[#fffaf1]" : state === "now" ? "border-[var(--accent)] bg-[var(--card)] text-[var(--accent)]" : "border-[var(--rule-2)] text-transparent"
                }`}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : state === "now" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              </span>
              <span>
                <span className={`block text-[15px] ${state === "todo" ? "text-[var(--faint)]" : "font-medium text-[var(--ink)]"}`}>{s.label}</span>
                {state === "now" && <span className="block text-[13px] text-[var(--muted)]">{s.hint}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {job.progress.notice && <p className="text-center text-[13px] text-[var(--muted)]">{job.progress.notice}</p>}

      <div className="rise d3 rounded-[var(--r-lg)] border border-[#EAD7B4] bg-[rgba(243,230,207,.55)] p-5">
        <p className="text-[15px] font-medium text-[var(--ink)]">You can close the app — your deck will be here.</p>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">It keeps being made on our server even if your phone locks or the internet drops. Open this site again and it appears under My decks.</p>
      </div>

      {link === "reconnecting" && (
        <p className="flex items-center justify-center gap-2 text-[13px] text-[var(--muted)]">
          <WifiOff className="h-4 w-4" /> Reconnecting. Your deck is still being made.
        </p>
      )}
    </div>
  );
}
