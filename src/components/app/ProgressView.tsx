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
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-[14px]">Loading your deck</span>
      </div>
    );

  if (job.status === "failed")
    return (
      <div className="space-y-5 py-6">
        <h2 className="text-[22px] font-semibold leading-tight text-[var(--ink)]">{job.topic}</h2>
        <div className="rounded-2xl border border-[#F3C7C7] bg-[#FDF2F2] p-5">
          <p className="text-[15px] font-medium text-[#9B1C1C]">This deck could not be finished.</p>
          <p className="mt-1 text-[14px] text-[#9B1C1C]/80">{job.error}</p>
        </div>
        <div className="flex gap-3">
          {onRetry && (
            <button onClick={onRetry} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3.5 text-[15px] font-semibold text-white">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          )}
          <button onClick={onHome} className="flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3.5 text-[15px] font-medium text-[var(--ink)]">
            New deck
          </button>
        </div>
      </div>
    );

  const queued = job.status === "queued";
  const pct = Math.max(queued ? 0 : 2, Math.min(100, Math.round(job.progress.percent)));
  const rank = RANK[job.progress.stage];

  return (
    <div className="space-y-6 py-2">
      <div>
        <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">{queued ? "Waiting in line" : "Making your presentation"}</p>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight text-[var(--ink)]">{job.topic}</h2>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        {queued ? (
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
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
              <span className="text-[40px] font-semibold leading-none tabular-nums text-[var(--ink)]">{pct}%</span>
              <span className="pb-1 text-[14px] text-[var(--muted)]">{job.etaSeconds != null ? `${formatDuration(job.etaSeconds)} left` : ""}</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      <ol className="space-y-1">
        {STEPS.map((s) => {
          const state = queued ? "todo" : rank > RANK[s.key] ? "done" : rank === RANK[s.key] ? "now" : "todo";
          return (
            <li key={s.key} className="flex items-start gap-3.5 rounded-xl px-1 py-2.5">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  state === "done" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : state === "now" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] text-transparent"
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

      <div className="rounded-2xl bg-[var(--accent-soft)] p-4">
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
