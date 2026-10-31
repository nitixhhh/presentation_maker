"use client";
import { useRef, useState } from "react";

/** Before/after slider: a typical plain template vs a real DeckCraft v3 export of the same topic. */
export default function Compare() {
  const [pos, setPos] = useState(52);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.max(4, Math.min(96, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div className="glass rounded-[var(--r-xl)] p-2 sm:p-3">
      <div
        ref={box}
        className="relative select-none overflow-hidden rounded-[24px] bg-[#0b0f17] [container-type:inline-size] [touch-action:pan-y]"
        style={{ aspectRatio: "16 / 9", cursor: "ew-resize" }}
        onPointerDown={(e) => {
          drag.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => drag.current && move(e.clientX)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/uv03.webp" alt="DeckCraft slide: UV-Visible spectroscopy principle, with a labelled diagram" width={1280} height={720} loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white px-[6cqw] py-[5cqw] font-[Arial,Helvetica,sans-serif] text-[#222]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} aria-hidden="true">
          <p className="text-[4.6cqw] font-bold leading-tight text-[#1f4e9c]">UV-Visible Spectroscopy</p>
          <ul className="mt-[3cqw] list-disc space-y-[1.4cqw] pl-[3.4cqw] text-[2.7cqw] leading-snug">
            <li>Introduction to UV-Vis</li>
            <li>It is a technique used in chemistry</li>
            <li>It measures absorbance of light</li>
            <li>Beer-Lambert law is used</li>
            <li>It has many applications</li>
          </ul>
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-[2px] bg-white/90 shadow-[0_0_12px_rgba(0,0,0,.25)]" />
          <div className="glass absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-[var(--ink)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 5l-4 5 4 5M13 5l4 5-4 5" />
            </svg>
          </div>
        </div>
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[rgba(29,25,19,.72)] px-2.5 py-1 text-[11.5px] font-medium text-[#fbf6ec]">The usual template</span>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-[rgba(164,97,15,.92)] px-2.5 py-1 text-[11.5px] font-medium text-[#fffaf1]">DeckCraft</span>
        <label className="sr-only">
          Compare before and after
          <input type="range" min={4} max={96} value={Math.round(pos)} onChange={(e) => setPos(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 pb-1.5 pt-3 text-[13px] text-[var(--muted)]">
        <span>Slide 3 of 10 · labelled diagram · cited</span>
        <span className="font-medium text-[var(--ink-2)]">Real export, no edits</span>
      </div>
    </div>
  );
}
