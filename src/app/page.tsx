import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import Nav from "@/components/landing/Nav";
import HeroComposer from "@/components/landing/HeroComposer";
import GoogleStart from "@/components/landing/GoogleStart";
import Compare from "@/components/landing/Compare";
import Faq from "@/components/landing/Faq";
import Reveal from "@/components/landing/Reveal";
import LegacyRedirect from "@/components/landing/LegacyRedirect";
import { PreWake } from "@/components/app/ServerWake";
import { Wordmark } from "@/components/brand/Brand";

const CONTACT = "nitish.gowala@mail.tab.bot";

function Slide({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={1280} height={720} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} className={`block aspect-video w-full rounded-[inherit] object-cover ${className}`} />
  );
}

function SectionHead({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent: string; children?: React.ReactNode }) {
  return (
    <div data-reveal className="mx-auto mb-10 max-w-[720px] text-center sm:mb-14">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="display mt-3 text-[36px] sm:text-[56px]">
        {title}
        <br />
        <span className="accent-serif">{accent}</span>
      </h2>
      {children && <p className="lede mx-auto mt-4 max-w-[560px] text-[16px] sm:text-[17.5px]">{children}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <LegacyRedirect />
      <PreWake />
      <Reveal />
      <Nav />

      {/* ---------- hero: the composer is the product ---------- */}
      <section className="relative px-5 pb-10 pt-[104px] sm:pt-[140px]">
        <div className="mx-auto max-w-[1000px] text-center">
          <div className="glass rise inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-[var(--ink-2)]">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[12px] font-semibold text-[var(--accent-ink)]">New</span>
            Decks in Hindi and Hinglish too
          </div>
          <h1 className="display rise d1 mt-6 text-[46px] sm:text-[84px]">
            Give a topic.
            <br />
            <span className="accent-serif whitespace-nowrap">Get a ready deck</span> <span className="whitespace-nowrap">in 10 minutes.</span>
          </h1>
          <p className="lede rise d2 mx-auto mt-5 max-w-[600px] text-[16.5px] sm:text-[19px]">
            Research-backed slides with real sources, clean diagrams and your college's title slide. The preview is free; pay only for the decks you keep.
          </p>
          <div className="rise d3 relative z-20 mx-auto mt-8 max-w-[680px]">
            <HeroComposer />
          </div>
          <div className="rise d4 mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GoogleStart className="w-full max-w-[340px] sm:w-auto" />
            <a href="#compare" className="btn btn-ghost w-full max-w-[340px] sm:w-auto">
              See samples
            </a>
          </div>
          <p className="rise d4 mt-3 text-[13px] text-[var(--muted)]">Free preview. No card needed.</p>
        </div>

        <div className="rise d5 relative mx-auto mt-12 max-w-[1080px] sm:mt-16" aria-label="Slides made by DeckCraft">
          <div className="absolute left-0 top-[10%] hidden w-[40%] -rotate-[5deg] overflow-hidden rounded-[18px] shadow-[var(--shadow-lg)] sm:block">
            <Slide src="/landing/lib07.webp" alt="Smart Library System slide" />
          </div>
          <div className="absolute right-0 top-[10%] hidden w-[40%] rotate-[5deg] overflow-hidden rounded-[18px] shadow-[var(--shadow-lg)] sm:block">
            <Slide src="/landing/ps03.webp" alt="Photosynthesis slide" />
          </div>
          <div className="glass relative mx-auto w-full rounded-[24px] p-1.5 sm:w-[62%] sm:rounded-[28px] sm:p-2">
            <div className="overflow-hidden rounded-[18px] sm:rounded-[22px]">
              <Slide src="/landing/uv01.webp" alt="UV-Visible Spectroscopy title slide made by DeckCraft" eager />
            </div>
          </div>
          <div className="mt-3 flex gap-3 sm:hidden">
            <div className="w-1/2 overflow-hidden rounded-[14px] shadow-[var(--shadow-sm)]">
              <Slide src="/landing/lib07.webp" alt="Smart Library System slide" />
            </div>
            <div className="w-1/2 overflow-hidden rounded-[14px] shadow-[var(--shadow-sm)]">
              <Slide src="/landing/ps03.webp" alt="Photosynthesis slide" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="scroll-mt-24 px-5 py-14 sm:py-24">
        <div className="mx-auto max-w-[1080px]">
          <SectionHead eyebrow="How it works" title="Three steps." accent="Zero formatting.">
            You give a topic. DeckCraft reads, writes, designs and checks every slide, then shows you the whole deck before you pay.
          </SectionHead>
          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            <div data-reveal className="panel flex flex-col rounded-[var(--r-lg)] p-6">
              <span className="eyebrow text-[var(--accent-ink)]">01</span>
              <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.025em]">Write your topic</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Topic, class and number of slides. Add your roll no., guide and college logo for a proper title slide.</p>
              <div className="mt-6 space-y-2 rounded-[var(--r-md)] border border-[var(--rule)] bg-[var(--card)] p-4 text-[13.5px]">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">Smart Library System</span>
                  <span className="text-[var(--muted)]">12 slides</span>
                </div>
                <div className="text-[var(--muted)]">B.Tech CSE · Project review</div>
              </div>
            </div>
            <div data-reveal style={{ ["--delay" as string]: "90ms" }} className="panel flex flex-col rounded-[var(--r-lg)] p-6">
              <span className="eyebrow text-[var(--accent-ink)]">02</span>
              <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.025em]">Research, then design</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Facts are cited from real sources. Every slide gets its own layout and diagram, then a quality check.</p>
              <div className="mt-6 space-y-2 rounded-[var(--r-md)] border border-[var(--rule)] bg-[var(--card)] p-4 text-[13.5px]">
                {["NCERT Biology XI", "Britannica: Calvin cycle", "Khan Academy"].map((x) => (
                  <div key={x} className="flex items-center justify-between gap-3">
                    <span>{x}</span>
                    <span className="badge py-0.5">cited</span>
                  </div>
                ))}
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
                  <div className="h-full w-[68%] rounded-full bg-[var(--accent)]" />
                </div>
              </div>
            </div>
            <div data-reveal style={{ ["--delay" as string]: "180ms" }} className="panel flex flex-col rounded-[var(--r-lg)] p-6">
              <span className="eyebrow text-[var(--accent-ink)]">03</span>
              <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.025em]">Preview, then unlock</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">See the whole deck for free. Like it? Unlock the clean PDF and editable PPTX.</p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="overflow-hidden rounded-[10px]">
                  <Slide src="/landing/ps01.webp" alt="" />
                </div>
                <div className="relative overflow-hidden rounded-[10px]">
                  <Slide src="/landing/ps03.webp" alt="" />
                  <span className="absolute inset-0 flex items-center justify-center bg-[rgba(255,253,248,.35)] text-[9px] font-semibold uppercase tracking-[.2em] text-[var(--ink)]/70">Preview</span>
                </div>
                <div className="overflow-hidden rounded-[10px]">
                  <Slide src="/landing/uv05.webp" alt="" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- before / after ---------- */}
      <section id="compare" className="scroll-mt-24 px-5 py-14 sm:py-24">
        <div className="mx-auto max-w-[1000px]">
          <SectionHead eyebrow="Before / after" title="Same topic." accent="Different league.">
            Left: the template made at 2 a.m. Right: a real DeckCraft export for B.Sc Chemistry. Drag to compare.
          </SectionHead>
          <div data-reveal>
            <Compare />
          </div>
          <div data-reveal className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4">
            {[
              ["/landing/lib01.webp", "Smart Library System", "B.Tech CSE"],
              ["/landing/ps01.webp", "Photosynthesis", "Hindi deck, B.Sc"],
              ["/landing/uv05.webp", "UV-Vis applications", "B.Sc Chemistry"],
            ].map(([src, t, c]) => (
              <figure key={src}>
                <div className="overflow-hidden rounded-[12px] shadow-[var(--shadow-sm)] sm:rounded-[16px]">
                  <Slide src={src} alt={`${t} slide`} />
                </div>
                <figcaption className="mt-2 text-[12px] leading-tight text-[var(--muted)] sm:text-[13.5px]">
                  <span className="block font-medium text-[var(--ink-2)]">{t}</span>
                  {c}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className="scroll-mt-24 px-5 py-14 sm:py-24">
        <div className="mx-auto max-w-[1080px]">
          <SectionHead eyebrow="Pricing" title="Pay per deck." accent="No subscription.">
            Every deck starts with a free watermarked preview. You pay only for the clean files.
          </SectionHead>
          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { name: "First deck", tag: "Intro price", amt: "₹9", unit: "", note: "Your first deck, fully unlocked.", feat: true },
              { name: "Single deck", tag: "", amt: "₹39", unit: "per deck", note: "No watermark. Keep it and edit it." },
              { name: "Semester pack", tag: "Best value", amt: "₹149", unit: "for 5 decks", note: "About ₹30 a deck. Use them any time." },
            ].map((p, i) => (
              <div
                key={p.name}
                data-reveal
                style={{ ["--delay" as string]: `${i * 90}ms` }}
                className={`panel relative rounded-[var(--r-lg)] p-6 ${p.feat ? "!outline-[1.5px] !outline-[var(--accent)]" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium text-[var(--ink-2)]">{p.name}</span>
                  {p.tag && <span className="badge">{p.tag}</span>}
                </div>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-[52px] font-semibold leading-none tracking-[-0.05em]">{p.amt}</span>
                  {p.unit && <span className="text-[14px] text-[var(--muted)]">{p.unit}</span>}
                </div>
                <p className="mt-3 text-[15px] text-[var(--muted)]">{p.note}</p>
              </div>
            ))}
          </div>
          <div data-reveal className="mx-auto mt-6 flex max-w-[860px] flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px] text-[var(--ink-2)]">
            {["PDF without watermark", "Editable PPTX", "Speaker notes", "2 free slide edits"].map((x) => (
              <span key={x} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[var(--accent)]" strokeWidth={2.4} />
                {x}
              </span>
            ))}
          </div>
          <p data-reveal className="mt-3 text-center text-[13.5px] text-[var(--muted)]">
            UPI, cards and wallets. The preview is always free.
          </p>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-24 px-5 py-14 sm:py-24">
        <div className="mx-auto max-w-[760px]">
          <SectionHead eyebrow="FAQ" title="Questions?" accent="Straight answers." />
          <div data-reveal>
            <Faq />
          </div>
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="px-5 pb-16 pt-6 sm:pb-24">
        <div data-reveal className="glass mx-auto max-w-[1080px] rounded-[var(--r-xl)] px-6 py-14 text-center sm:py-20">
          <span className="eyebrow">Submission due tomorrow?</span>
          <h2 className="display mt-3 text-[34px] sm:text-[60px]">
            Write your topic.
            <br />
            <span className="accent-serif">We'll handle the rest.</span>
          </h2>
          <Link href="/create" className="btn btn-ink mt-8">
            Make a free preview <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--rule)] px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-[13px] text-[var(--muted)]">Made in India, for classrooms everywhere.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[var(--ink-2)]">
            <Link href="/create" className="hover:text-[var(--ink)]">Create</Link>
            <Link href="/privacy" className="hover:text-[var(--ink)]">Privacy</Link>
            <a href={`mailto:${CONTACT}`} className="hover:text-[var(--ink)]">Contact</a>
          </nav>
        </div>
        <p className="mx-auto mt-6 max-w-[1080px] text-[12px] text-[var(--faint)]">© 2026 DeckCraft</p>
      </footer>
    </>
  );
}
