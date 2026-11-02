"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Brand";
import { api } from "@/lib/client/auth";
import { PLAN_KEY } from "@/lib/client/store";

interface Plan {
  id: string;
  engine: "v3" | "v5" | "v6";
  name: string;
  tagline: string;
  points: string[];
  approxTime: string;
  price: string | null;
  preview: { src: string; alt: string }[];
}
interface PlansData {
  public: boolean;
  default: string;
  plans: Plan[];
}

/**
 * /plans — the three plans, each with real slides its engine made ("this plan makes decks like this").
 * Only the owner sees it until PLANS_PUBLIC=true; everyone else gets the normal 404 page.
 */
export default function PlansView() {
  const router = useRouter();
  const [data, setData] = useState<PlansData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState<{ plan: Plan; i: number } | null>(null);

  useEffect(() => {
    let stop = false; // api() waits for the login state, so the owner's token goes with the request
    api("/api/plans")
      .then(async (r) => {
        if (stop) return;
        if (!r.ok) return setHidden(true);
        setHidden(false);
        setData(await r.json());
      })
      .catch(() => !stop && setHidden(true));
    return () => {
      stop = true;
    };
  }, []);

  const choose = (p: Plan) => {
    localStorage.setItem(PLAN_KEY, p.engine);
    router.push("/create");
  };

  return (
    <main className="mx-auto max-w-[680px] px-4 pb-20 pt-[max(16px,env(safe-area-inset-top))] sm:px-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="press inline-block py-3">
          <Wordmark />
        </Link>
        {data && (
          <Link href="/create" className="btn btn-ghost btn-sm">
            Make a deck
          </Link>
        )}
      </div>

      {hidden && !data && (
        <div className="panel mt-6 rounded-[var(--r-lg)] p-6 text-center sm:p-9">
          <span className="eyebrow">404</span>
          <h1 className="display mt-3 text-[34px] sm:text-[44px]">
            This page <span className="accent-serif">doesn&apos;t exist.</span>
          </h1>
          <p className="mt-3 text-[15.5px] text-[var(--muted)]">The link may be old or mistyped.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/create" className="btn btn-ink">
              Make a deck
            </Link>
          </div>
        </div>
      )}

      {!hidden && !data && (
        <div className="mt-8 space-y-4" aria-busy="true">
          {[0, 1, 2].map((k) => (
            <div key={k} className="panel h-[320px] animate-pulse rounded-[var(--r-lg)]" />
          ))}
        </div>
      )}

      {data && (
        <>
          <header className="mt-6 px-1">
            <span className="eyebrow">Plans</span>
            <h1 className="display mt-2.5 text-[34px] leading-[1.05] sm:text-[44px]">
              Three ways to <span className="accent-serif">make a deck.</span>
            </h1>
            <p className="lede mt-2.5 text-[15.5px]">Every plan researches real sources and gives you a PDF and an editable PowerPoint. The slides below were made by each plan, not edited by hand.</p>
            {!data.public && <p className="mt-4 rounded-[var(--r-md)] border border-[var(--rule)] bg-[rgba(255,253,248,.7)] px-3.5 py-2.5 text-[13px] text-[var(--muted)]">Only you can see this page. It opens to everyone when PLANS_PUBLIC is set to true.</p>}
          </header>

          <div className="mt-7 space-y-5">
            {data.plans.map((p) => (
              <section key={p.id} aria-labelledby={`plan-${p.id}`} className="panel overflow-hidden rounded-[var(--r-lg)]">
                <div className="px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 id={`plan-${p.id}`} className="text-[24px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                      {p.name}
                    </h2>
                    <span className="mt-1 shrink-0 rounded-full border border-[var(--rule)] px-3 py-1 text-[13px] font-medium text-[var(--ink)]">{p.price || "Price coming soon"}</span>
                  </div>
                  <p className="mt-1 text-[15px] leading-snug text-[var(--ink-2)]">{p.tagline}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {p.approxTime} per deck
                  </p>
                </div>

                <div className="-mt-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-3 pt-1 sm:px-6" aria-label={`Slides made by ${p.name}`}>
                  {p.preview.map((s, i) => (
                    <button key={s.src} onClick={() => setOpen({ plan: p, i })} className="press w-[84%] shrink-0 snap-start overflow-hidden rounded-[12px] border border-[var(--rule)] sm:w-[62%]" aria-label={`Open slide ${i + 1}: ${s.alt}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.src} alt={s.alt} width={960} height={540} loading={i < 2 ? "eager" : "lazy"} decoding="async" className="block w-full" style={{ aspectRatio: "16/9", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>

                <div className="px-4 pb-4 sm:px-6 sm:pb-5">
                  <ul className="space-y-1.5 text-[14px] leading-snug text-[var(--ink-2)]">
                    {p.points.map((t) => (
                      <li key={t} className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => choose(p)} className="btn btn-ink mt-4 w-full">
                    Make a deck with {p.name}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#14110c] p-4" role="dialog" aria-label={`${open.plan.name} slides`}>
          <div className="flex items-center justify-between text-white">
            <p className="truncate pr-4 text-[15px] font-medium">{open.plan.name}</p>
            <button aria-label="Close" onClick={() => setOpen(null)} className="p-2">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.plan.preview[open.i].src} alt={open.plan.preview[open.i].alt} className="pop w-full max-w-[1100px] rounded-[12px]" style={{ aspectRatio: "16/9", objectFit: "contain" }} />
            <p className="max-w-[600px] text-center text-[13.5px] text-white/75">{open.plan.preview[open.i].alt}</p>
          </div>
          <div className="flex items-center justify-center gap-6 pb-4 text-white">
            <button aria-label="Previous" onClick={() => setOpen({ ...open, i: Math.max(0, open.i - 1) })} className="rounded-full bg-white/10 p-3">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="tabular-nums">
              {open.i + 1} / {open.plan.preview.length}
            </span>
            <button aria-label="Next" onClick={() => setOpen({ ...open, i: Math.min(open.plan.preview.length - 1, open.i + 1) })} className="rounded-full bg-white/10 p-3">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
