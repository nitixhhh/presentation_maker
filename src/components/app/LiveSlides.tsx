"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { LiveDeck, LiveSlide } from "./types";

/** Engine v4: every slide shows up the moment its designer agent submits it; slides still being made show what the agent is doing. */
export default function LiveSlides({ live }: { live: LiveDeck }) {
  const slides = live.slides;
  const shown = slides.filter((s) => s.image).length;
  const [pick, setPick] = useState<number | null>(null);
  // follow the work: the newest ready slide, else the first one being built — until the user taps a slide
  const auto = useMemo(() => {
    const building = slides.find((s) => s.state === "building");
    const lastReady = [...slides].reverse().find((s) => s.image);
    return (pick == null ? (building && (!lastReady || building.n === (lastReady?.n ?? 0) + 1) ? building : lastReady || building || slides[0]) : slides.find((s) => s.n === pick)) || slides[0];
  }, [slides, pick]);
  if (!slides.length) return null;
  return (
    <section className="rise d2 space-y-3" aria-label="Your slides as they are made">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-[15px] font-semibold text-[var(--ink)]">Your slides</span>
        <span className="text-[13px] text-[var(--muted)] tabular-nums">
          {shown} of {slides.length} ready
        </span>
      </div>
      <Big slide={auto} />
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {slides.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setPick(s.n === pick ? null : s.n)}
            aria-label={`Slide ${s.n}: ${s.title}`}
            aria-pressed={auto.n === s.n}
            className={`press relative aspect-video w-[132px] shrink-0 snap-start overflow-hidden rounded-[10px] border transition-shadow sm:w-[150px] ${auto.n === s.n ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-ring)]" : "border-[var(--rule)]"}`}
          >
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className={`absolute inset-0 ${s.state === "building" ? "live-shimmer" : "bg-[rgba(29,25,19,.05)]"}`} />
            )}
            <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(20,17,12,.72)] px-1.5 py-[1px] text-[11px] font-semibold tabular-nums text-white">{s.n}</span>
            {s.state === "building" && !s.image && <Loader2 className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 animate-spin text-[var(--accent)]" />}
            {s.state === "done" && <Check className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-[var(--accent)] p-[2px] text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <style>{`
        .live-shimmer{background:linear-gradient(110deg,rgba(29,25,19,.05) 30%,rgba(201,138,46,.22) 50%,rgba(29,25,19,.05) 70%);background-size:220% 100%;animation:liveShimmer 1.6s ease-in-out infinite}
        @keyframes liveShimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
        @keyframes liveFade{0%{opacity:0;transform:translateY(4px)}12%{opacity:1;transform:none}88%{opacity:1}100%{opacity:0}}
        @keyframes liveBar{0%,100%{opacity:.35}50%{opacity:.8}}
        @media (prefers-reduced-motion: reduce){.live-shimmer{animation:none}}
      `}</style>
    </section>
  );
}

function Big({ slide }: { slide: LiveSlide }) {
  if (slide.image)
    return (
      <figure className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--rule)] bg-white shadow-[0_10px_30px_rgba(29,25,19,.10)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image} alt={`Slide ${slide.n}: ${slide.title}`} className="block aspect-video w-full object-cover" />
        <figcaption className="flex items-center justify-between gap-3 border-t border-[var(--rule)] px-4 py-2.5 text-[13px]">
          <span className="min-w-0 truncate text-[var(--ink)]">
            <span className="mr-1.5 font-semibold tabular-nums">{slide.n}.</span>
            {slide.title}
          </span>
          <span className="shrink-0 text-[var(--muted)]">{slide.state === "polishing" ? "Polishing" : slide.state === "done" ? "Done" : "Ready"}</span>
        </figcaption>
      </figure>
    );
  return <Building slide={slide} />;
}

const WAITING = ["Waiting for a free designer", "Another slide is being made first", "This slide is next in line"];

function Building({ slide }: { slide: LiveSlide }) {
  const msgs = slide.state === "waiting" ? WAITING : slide.statuses.length ? slide.statuses : ["Reading the slide brief"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 2300);
    return () => clearInterval(t);
  }, []);
  // the newest real step first, then the agent's earlier steps in turn
  const ordered = slide.state === "waiting" ? msgs : [msgs[msgs.length - 1], ...msgs.slice(0, -1).reverse()];
  const text = ordered[i % ordered.length].replace(/…$/, "");
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--r-lg)] border border-[var(--rule)] bg-[rgba(255,253,248,.9)]">
      <div className="live-shimmer absolute inset-0 opacity-70" />
      <div className="absolute inset-0 flex flex-col justify-between p-[6%]">
        <div className="space-y-2.5">
          <div className="h-[9%] min-h-3 w-[46%] rounded-full bg-[rgba(29,25,19,.10)] [animation:liveBar_2s_ease-in-out_infinite]" />
          <div className="h-[5%] min-h-2 w-[30%] rounded-full bg-[rgba(29,25,19,.08)] [animation:liveBar_2s_ease-in-out_.3s_infinite]" />
        </div>
        <div className="grid grid-cols-3 gap-[4%]">
          {[0, 1, 2].map((k) => (
            <div key={k} className="aspect-[4/3] rounded-[10px] bg-[rgba(29,25,19,.07)] [animation:liveBar_2s_ease-in-out_infinite]" style={{ animationDelay: `${0.2 * k + 0.4}s` }} />
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-[linear-gradient(0deg,rgba(255,253,248,.97),rgba(255,253,248,.0))] px-4 pb-3.5 pt-8">
        {slide.state === "waiting" ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--faint)]" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />}
        <span className="min-w-0">
          <span className="block text-[12px] font-medium text-[var(--muted)]">
            Slide {slide.n} · {slide.title}
          </span>
          <span key={`${slide.n}-${i}`} className="block truncate text-[15px] font-medium text-[var(--ink)] [animation:liveFade_2.3s_ease-in-out]">
            {text}
          </span>
        </span>
      </div>
    </div>
  );
}
