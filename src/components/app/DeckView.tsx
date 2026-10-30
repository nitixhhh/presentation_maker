"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, FileText, Loader2 } from "lucide-react";
import type { DeckSummary } from "./types";

export default function DeckView({ deck }: { deck: DeckSummary }) {
  const [i, setI] = useState(0);
  const [tab, setTab] = useState<"slides" | "notes" | "refs">("slides");
  const s = deck.slides[i];
  const last = deck.slides.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(last, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  // swipe between slides
  const [x0, setX0] = useState<number | null>(null);

  const dl = (format: "pdf" | "pptx") => `/api/v3/deck/${deck.deckId}/export?format=${format}`;
  const btn = "flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-semibold";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">Ready</p>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight text-[var(--ink)]">{deck.title}</h2>
        <p className="mt-1 text-[14px] text-[var(--muted)]">
          {deck.slides.length} slides · {deck.language} · {deck.references.length} references
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a href={dl("pdf")} className={`${btn} bg-[var(--accent)] text-white`}>
          <Download className="h-4 w-4" /> PDF
        </a>
        <a href={dl("pptx")} className={`${btn} border border-[var(--line)] bg-white text-[var(--ink)]`}>
          <Download className="h-4 w-4" /> PowerPoint
        </a>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[#0b0f17] shadow-sm"
        style={{ aspectRatio: "16 / 9" }}
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (dx < -40) setI((v) => Math.min(last, v + 1));
          if (dx > 40) setI((v) => Math.max(0, v - 1));
          setX0(null);
        }}
      >
        {s && <SlideImage key={s.image} src={s.image} alt={s.title} />}
      </div>

      <div className="flex items-center justify-between">
        <button aria-label="Previous slide" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded-full border border-[var(--line)] bg-white p-3 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[14px] tabular-nums text-[var(--muted)]">
          {i + 1} / {deck.slides.length}
        </span>
        <button aria-label="Next slide" onClick={() => setI(Math.min(last, i + 1))} disabled={i === last} className="rounded-full border border-[var(--line)] bg-white p-3 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-[var(--chip)] p-1">
        {(
          [
            ["slides", "All slides"],
            ["notes", "Speaker notes"],
            ["refs", "References"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 text-[13px] font-medium ${tab === k ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)]"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "slides" && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {deck.slides.map((t, k) => (
            <button
              key={t.n}
              onClick={() => {
                setI(k);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`overflow-hidden rounded-lg border-2 bg-[#0b0f17] ${k === i ? "border-[var(--accent)]" : "border-transparent"}`}
              style={{ aspectRatio: "16 / 9" }}
              title={t.title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.image} alt={t.title} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {tab === "notes" && (
        <div className="rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-[13px] font-medium text-[var(--muted)]">
            Slide {i + 1}: {s?.title}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">{s?.notes || "No notes for this slide."}</p>
        </div>
      )}
      {tab === "refs" && (
        <ol className="space-y-2.5 rounded-xl border border-[var(--line)] bg-white p-4">
          {deck.references.map((r) => (
            <li key={r.n} className="text-[14px] leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">
              <span className="text-[var(--muted)]">[{r.n}]</span> {r.text}
            </li>
          ))}
          {!deck.references.length && <li className="text-[14px] text-[var(--muted)]">No references.</li>}
        </ol>
      )}

      <a href={`/api/v3/deck/${deck.deckId}/export?format=html&view=1`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2 text-[14px] font-medium text-[var(--accent)]">
        <Maximize2 className="h-4 w-4" /> Present full screen
      </a>
    </div>
  );
}

function SlideImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onLoad={() => setLoaded(true)} className="absolute inset-0 h-full w-full object-contain" />
    </>
  );
}

export function DeckIcon() {
  return <FileText className="h-5 w-5" />;
}
