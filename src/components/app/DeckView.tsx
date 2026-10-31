"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, FileText, Loader2, Lock, Pencil, Check } from "lucide-react";
import type { DeckSummary } from "./types";
import { api, signInWithGoogle, type Me } from "@/lib/client/auth";
import { useJob } from "./useJob";
import Select from "@/components/ui/Select";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((res) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });
}

export default function DeckView({ deck, me, onReload }: { deck: DeckSummary; me: Me | null; onReload: () => void }) {
  const [i, setI] = useState(0);
  const [tab, setTab] = useState<"slides" | "notes" | "refs" | "edit">("slides");
  const [msg, setMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const s = deck.slides[i];
  const last = deck.slides.length - 1;
  const locked = !!deck.locked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,[role=combobox]")) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(last, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const [x0, setX0] = useState<number | null>(null);
  const btn = "btn";

  const download = async (format: "pdf" | "pptx" | "notes" | "html") => {
    setMsg(null);
    const w = format === "html" ? window.open("about:blank", "_blank") : null;
    const r = await api(`/api/v3/deck/${deck.deckId}/download?format=${format}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) {
      w?.close();
      setMsg(d.error || "Download failed. Please try again.");
      return;
    }
    if (w) w.location.href = d.url;
    else window.location.href = d.url;
  };

  const pay = async (product: "deck" | "pack5") => {
    setMsg(null);
    if (me?.auth.required && !me.user) {
      await signInWithGoogle().catch((e) => setMsg(e.message));
      return;
    }
    setPaying(product);
    try {
      const r = await api("/api/pay/order", { method: "POST", body: JSON.stringify({ product, deckId: deck.deckId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not start the payment.");
      if (d.alreadyUnlocked || d.free) return onReload();
      const verify = async (body: Record<string, string>) => {
        const v = await api("/api/pay/verify", { method: "POST", body: JSON.stringify(body) });
        const vd = await v.json().catch(() => ({}));
        if (!v.ok) throw new Error(vd.error || "Payment could not be verified.");
        onReload();
      };
      if (d.provider === "mock") {
        await verify({ orderId: d.checkout.orderId, paymentId: d.checkout.paymentId, signature: d.checkout.signature });
        return;
      }
      if (!(await loadRazorpay())) throw new Error("Could not load the payment window. Check your internet.");
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay({
          key: d.checkout.keyId,
          order_id: d.checkout.orderId,
          amount: d.checkout.amount,
          currency: d.checkout.currency,
          name: "DeckCraft",
          description: product === "pack5" ? "5 deck credits" : deck.title.slice(0, 60),
          prefill: { email: d.user?.email || "", name: d.user?.name || "" },
          theme: { color: "#A4610F" },
          handler: (resp: Record<string, string>) => verify(resp).then(resolve, reject),
          modal: { ondismiss: () => resolve() },
        });
        rz.on("payment.failed", (e: any) => reject(new Error(e?.error?.description || "Payment failed.")));
        rz.open();
      });
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setPaying(null);
    }
  };

  const useCredit = async () => {
    setPaying("credit");
    const r = await api("/api/pay/credit", { method: "POST", body: JSON.stringify({ deckId: deck.deckId }) });
    setPaying(null);
    if (r.ok) onReload();
    else setMsg((await r.json().catch(() => ({}))).error || "Could not use a credit.");
  };

  const p = deck.payments;
  return (
    <div className="space-y-5">
      <div className="rise px-1">
        <span className={`badge ${locked ? "" : "!bg-[var(--ok-soft)] !text-[var(--ok)]"}`}>{locked ? "Free preview" : "Ready"}</span>
        <h2 className="display mt-3 text-[28px] sm:text-[34px]">{deck.title}</h2>
        <p className="mt-2 text-[14px] text-[var(--muted)]">
          {deck.slides.length} slides · {deck.language}
        </p>
      </div>

      {locked && p ? (
        <div className="glass rise d2 space-y-3.5 rounded-[var(--r-xl)] p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-[var(--ink)]">
            <Lock className="h-4 w-4 text-[var(--accent)]" /> Pasand aaya? Clean files unlock karo
          </p>
          <ul className="space-y-1.5 text-[14px] text-[var(--ink-2)]">
            {["PDF without watermark", "Editable PowerPoint (PPTX)", "Speaker notes (in the PPTX + a separate PDF)", `${deck.edits?.free ?? 2} free slide edits`].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[var(--accent)]" strokeWidth={2.4} /> {t}
              </li>
            ))}
          </ul>
          {p.credits > 0 ? (
            <button onClick={useCredit} disabled={!!paying} className={`${btn} btn-ink w-full`}>
              {paying === "credit" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Use 1 credit ({p.credits} left)
            </button>
          ) : (
            <button onClick={() => pay("deck")} disabled={!!paying} className={`${btn} btn-ink w-full`}>
              {paying === "deck" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {p.price <= 0 ? "Unlock free (your first deck)" : `Unlock for ₹${p.price}`}
            </button>
          )}
          <button onClick={() => pay("pack5")} disabled={!!paying} className={`${btn} btn-ghost w-full`}>
            {paying === "pack5" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 5 decks for ₹{p.pack5}
          </button>
          {p.testMode && <p className="text-center text-[12px] text-[var(--muted)]">Test mode — no real money is charged.</p>}
        </div>
      ) : (
        <div className="rise d2 grid grid-cols-2 gap-3">
          <button onClick={() => download("pdf")} className={`${btn} btn-ink`}>
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => download("pptx")} className={`${btn} btn-ghost`}>
            <Download className="h-4 w-4" /> PowerPoint
          </button>
        </div>
      )}
      {msg && <p className="rounded-[var(--r-md)] bg-[var(--bad-soft)] px-4 py-3 text-[14px] text-[var(--bad)]">{msg}</p>}

      <div
        className="relative overflow-hidden rounded-[18px] bg-[#1d1913] shadow-[var(--shadow)] ring-1 ring-[var(--hair)]"
        style={{ aspectRatio: "16 / 9" }}
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (dx < -40) setI((v) => Math.min(last, v + 1));
          if (dx > 40) setI((v) => Math.max(0, v - 1));
          setX0(null);
        }}
        onContextMenu={(e) => locked && e.preventDefault()}
      >
        {s && <SlideImage key={s.image} src={s.image} alt={s.title} />}
      </div>

      <div className="flex items-center justify-between">
        <button aria-label="Previous slide" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="press panel rounded-full p-3 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[14px] tabular-nums text-[var(--muted)]">
          {i + 1} / {deck.slides.length}
        </span>
        <button aria-label="Next slide" onClick={() => setI(Math.min(last, i + 1))} disabled={i === last} className="press panel rounded-full p-3 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 rounded-full bg-[rgba(29,25,19,.06)] p-1">
        {(
          [
            ["slides", "Slides"],
            ["notes", "Notes"],
            ["refs", "References"],
            ["edit", "Edit"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`press flex-1 rounded-full py-2.5 text-[13.5px] font-medium transition-colors ${tab === k ? "bg-[var(--card)] text-[var(--ink)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)]"}`}>
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
              className={`press overflow-hidden rounded-[12px] bg-[#1d1913] ring-offset-2 ring-offset-[var(--paper)] ${k === i ? "ring-2 ring-[var(--accent)]" : "ring-1 ring-[var(--hair)]"}`}
              style={{ aspectRatio: "16 / 9" }}
              title={t.title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.image} alt={t.title} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {tab === "notes" &&
        (locked ? (
          <LockedNote text="Speaker notes for every slide come with the unlocked deck — inside the PowerPoint and as a separate PDF." />
        ) : (
          <div className="panel space-y-3 rounded-[var(--r-lg)] p-5">
            <p className="text-[13px] font-medium text-[var(--muted)]">
              Slide {i + 1}: {s?.title}
            </p>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">{s?.notes || "No notes for this slide."}</p>
            <button onClick={() => download("notes")} className="flex items-center gap-2 text-[14px] font-medium text-[var(--accent-ink)]">
              <Download className="h-4 w-4" /> All speaker notes (PDF)
            </button>
          </div>
        ))}
      {tab === "refs" &&
        (locked ? (
          <LockedNote text="The full reference list is on the last slide of the unlocked deck." />
        ) : (
          <ol className="panel space-y-2.5 rounded-[var(--r-lg)] p-5">
            {deck.references.map((r) => (
              <li key={r.n} className="text-[14px] leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">
                <span className="text-[var(--muted)]">[{r.n}]</span> {r.text}
              </li>
            ))}
            {!deck.references.length && <li className="text-[14px] text-[var(--muted)]">No references.</li>}
          </ol>
        ))}
      {tab === "edit" && (locked ? <LockedNote text={`After unlocking you get ${deck.edits?.free ?? 2} free edits: pick a slide, say what to change, and the designer redoes it.`} /> : <EditPanel deck={deck} current={i} onDone={onReload} />)}

      {!locked && (
        <button onClick={() => download("html")} className="press flex w-full items-center justify-center gap-2 py-2 text-[14px] font-medium text-[var(--accent-ink)]">
          <Maximize2 className="h-4 w-4" /> Present full screen
        </button>
      )}
    </div>
  );
}

function LockedNote({ text }: { text: string }) {
  return (
    <p className="panel flex gap-2.5 rounded-[var(--r-lg)] p-5 text-[14px] leading-relaxed text-[var(--muted)]">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {text}
    </p>
  );
}

function EditPanel({ deck, current, onDone }: { deck: DeckSummary; current: number; onDone: () => void }) {
  const [n, setN] = useState(deck.slides[current]?.n || 1);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { job } = useJob(jobId);
  const used = deck.edits?.used ?? 0;
  const free = deck.edits?.free ?? 2;
  const left = Math.max(0, free - used);

  useEffect(() => {
    if (job?.status === "done") {
      setJobId(null);
      setText("");
      onDone();
    }
    if (job?.status === "failed") {
      setErr(job.error || "The edit failed. Your slide is unchanged; the edit was not counted.");
      setJobId(null);
    }
  }, [job?.status, job?.error, onDone]);

  const submit = async () => {
    setErr(null);
    const r = await api(`/api/v3/deck/${deck.deckId}/edit`, { method: "POST", body: JSON.stringify({ n, instruction: text }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "Could not start the edit.");
    setJobId(d.job.id);
  };

  if (jobId)
    return (
      <div className="panel flex items-center gap-3 rounded-[var(--r-lg)] p-5 text-[14px] text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" /> {job?.progress.step || "Redesigning the slide"} {job ? `· ${Math.round(job.progress.percent)}%` : ""}
      </div>
    );
  return (
    <div className="panel space-y-3.5 rounded-[var(--r-lg)] p-5">
      <p className="text-[14px] text-[var(--muted)]">
        <Pencil className="mr-1 inline h-4 w-4" /> {left} of {free} free edits left
      </p>
      <Select label="Slide" value={n} onChange={setN} options={deck.slides.map((s) => ({ value: s.n, label: `${s.n}. ${s.title}` }))} />
      <label className="block">
        <span className="label">What should change?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="e.g. Add the formula V = IR and make the photo smaller"
          className="field resize-none"
        />
      </label>
      <button onClick={submit} disabled={!left || text.trim().length < 4} className="btn btn-ink w-full">
        Redo this slide
      </button>
      {err && <p className="text-[14px] text-[var(--bad)]">{err}</p>}
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
      <img src={src} alt={alt} draggable={false} onLoad={() => setLoaded(true)} className="absolute inset-0 h-full w-full select-none object-contain" />
    </>
  );
}

export function DeckIcon() {
  return <FileText className="h-5 w-5" />;
}
