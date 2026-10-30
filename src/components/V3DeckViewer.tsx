"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, RotateCcw } from "lucide-react";

interface V3Slide {
  n: number;
  title: string;
  role?: string;
  url: string;
  notes?: string;
  qaScore?: number | null;
  revisions?: number;
}
export interface V3DeckSummary {
  engine: "v3";
  deckId: string;
  topic: string;
  title: string;
  language: string;
  design: { name: string; palette: Record<string, string>; fonts: string[]; motif: string };
  references: { n: number; text: string }[];
  slides: V3Slide[];
}

/** Scales a 1280×720 slide iframe to whatever width its container has. */
function SlideFrame({ src, title, interactive = false }: { src: string; title: string; interactive?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
      <iframe
        src={src}
        title={title}
        scrolling="no"
        style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, pointerEvents: interactive ? "auto" : "none" }}
        className="absolute top-0 left-0"
      />
    </div>
  );
}

export default function V3DeckViewer({ deck, onNew }: { deck: V3DeckSummary; onNew: () => void }) {
  const [i, setI] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const s = deck.slides[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(deck.slides.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.slides.length]);

  const download = async (format: "pdf" | "pptx" | "html") => {
    setBusy(format);
    try {
      const res = await fetch(`/api/v3/deck/${deck.deckId}/export?format=${format}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.title.replace(/[^a-z0-9]+/gi, "_")}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately cancels the download on some mobile browsers (iOS Safari) — wait a bit.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const btn = "px-4 py-2.5 text-xs font-semibold rounded-2xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50";
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#E8E2D5] p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div>
          <h2 className="font-serif font-bold text-[#1F1E1D] text-lg md:text-xl">{deck.title}</h2>
          <p className="text-xs text-[#736F68] mt-0.5">
            Engine v3 • {deck.slides.length} slides • {deck.design.name} • {deck.design.fonts.join(" / ")} • {deck.references.length} references
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => download("pptx")} disabled={!!busy} className={`${btn} bg-[#C15B3E] hover:bg-[#A84E34] text-white`}>
            <Download className="w-3.5 h-3.5" /> {busy === "pptx" ? "Building…" : "PPTX"}
          </button>
          <button onClick={() => download("pdf")} disabled={!!busy} className={`${btn} bg-white hover:bg-[#FAF7F2] text-[#1F1E1D] border border-[#E5DEC9]`}>
            <Download className="w-3.5 h-3.5" /> {busy === "pdf" ? "Building…" : "PDF"}
          </button>
          <button onClick={() => window.open(`/api/v3/deck/${deck.deckId}/export?format=html&view=1`, "_blank")} className={`${btn} bg-white hover:bg-[#FAF7F2] text-[#1F1E1D] border border-[#E5DEC9]`}>
            <Eye className="w-3.5 h-3.5" /> HTML
          </button>
          <button onClick={onNew} className={`${btn} text-[#736F68] hover:text-[#1F1E1D] font-medium`}>
            <RotateCcw className="w-3.5 h-3.5" /> New Deck
          </button>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden shadow-xl border border-[#E5DEC9] bg-black">
        {s && <SlideFrame key={s.url} src={s.url} title={s.title} interactive />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className={`${btn} bg-white border border-[#E5DEC9] text-[#1F1E1D] disabled:opacity-30`}>
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-xs text-[#736F68]">
          Slide {i + 1} of {deck.slides.length}
          {s?.qaScore ? ` • QA ${s.qaScore}/10` : ""}
          {s?.revisions ? ` • revised ×${s.revisions}` : ""}
        </span>
        <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-[#736F68] hover:text-[#1F1E1D] cursor-pointer">
          {showNotes ? "Hide notes" : "Speaker notes"}
        </button>
        <button onClick={() => setI(Math.min(deck.slides.length - 1, i + 1))} disabled={i === deck.slides.length - 1} className={`${btn} bg-white border border-[#E5DEC9] text-[#1F1E1D] disabled:opacity-30`}>
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {showNotes && s?.notes && <div className="bg-white border border-[#E8E2D5] rounded-2xl p-4 text-sm text-[#2E2C29] whitespace-pre-wrap">{s.notes}</div>}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {deck.slides.map((t, k) => (
          <button key={t.n} onClick={() => setI(k)} className={`rounded-xl overflow-hidden border-2 ${k === i ? "border-[#C15B3E]" : "border-transparent"} bg-black cursor-pointer`} title={t.title}>
            <SlideFrame src={t.url} title={t.title} />
          </button>
        ))}
      </div>
    </div>
  );
}
