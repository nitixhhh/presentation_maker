"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ArrowRight, Loader2 } from "lucide-react";
import Select from "@/components/ui/Select";
import { useRef } from "react";
import { clientId } from "@/lib/client/store";

export interface CreateRequest {
  topic: string;
  audience: string;
  slideCount: number;
  language: "English" | "Hindi" | "Hinglish";
  purpose: string;
  formatNotes: string;
  logoId?: string;
  presenter: { names: string; rollNo: string; department: string; institute: string; guide: string; course: string };
  ageConfirmed?: boolean;
}

const EMPTY: CreateRequest = {
  topic: "",
  audience: "",
  slideCount: 10,
  language: "English",
  purpose: "Seminar",
  formatNotes: "",
  presenter: { names: "", rollNo: "", department: "", institute: "", guide: "", course: "" },
};

export const AGE_KEY = "dc_age_ok";

const PURPOSES = ["Seminar", "Project review", "Class presentation", "Lab report", "Lecture"];
const SLIDES = [6, 8, 10, 12, 15, 18, 20];

export const field = "field";
const label = "label";

export default function CreateForm({ onSubmit, busy, error }: { onSubmit: (r: CreateRequest) => void; busy: boolean; error: string | null }) {
  const [r, setR] = useState<CreateRequest>(EMPTY);
  const [more, setMore] = useState(false);
  // Gemini API terms: users must be 18+. Asked once per phone, remembered in localStorage.
  const [ageOk, setAgeOk] = useState(() => typeof window !== "undefined" && localStorage.getItem(AGE_KEY) === "1");
  const set = <K extends keyof CreateRequest>(k: K, v: CreateRequest[K]) => setR((x) => ({ ...x, [k]: v }));
  const setP = (k: keyof CreateRequest["presenter"], v: string) => setR((x) => ({ ...x, presenter: { ...x.presenter, [k]: v } }));

  // topic / slides / language typed on the landing page arrive as ?topic=&slides=&lang=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const topic = q.get("topic");
    const slides = Number(q.get("slides"));
    const lang = q.get("lang");
    if (!topic && !slides && !lang) return;
    // read after hydration on purpose: the page is prerendered, so the URL is only known in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setR((x) => ({
      ...x,
      ...(topic ? { topic: topic.slice(0, 300) } : {}),
      ...(SLIDES.includes(slides) ? { slideCount: slides } : {}),
      ...(lang === "English" || lang === "Hindi" || lang === "Hinglish" ? { language: lang } : {}),
    }));
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (r.topic.trim().length >= 3 && ageOk && !busy) onSubmit({ ...r, ageConfirmed: true });
      }}
      className="space-y-6"
    >
      <div>
        <label htmlFor="topic" className={label}>
          Topic
        </label>
        <textarea
          id="topic"
          rows={2}
          value={r.topic}
          onChange={(e) => set("topic", e.target.value)}
          placeholder="e.g. UV-Visible Spectroscopy: principle and applications"
          className={`${field} resize-none leading-snug`}
          maxLength={300}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Slides" value={r.slideCount} onChange={(v) => set("slideCount", v)} options={SLIDES.map((n) => ({ value: n, label: `${n} slides` }))} />
        <Select
          label="Language"
          value={r.language}
          onChange={(v) => set("language", v)}
          options={[
            { value: "English", label: "English" },
            { value: "Hindi", label: "Hindi", hint: "हिन्दी" },
            { value: "Hinglish", label: "Hinglish" },
          ]}
        />
      </div>

      <div>
        <label htmlFor="aud" className={label}>
          Class / audience
        </label>
        <input id="aud" value={r.audience} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. B.Tech CSE, 3rd semester" className={field} maxLength={160} />
      </div>

      <div>
        <span className={label}>Type</span>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <button type="button" key={p} aria-pressed={r.purpose === p} onClick={() => set("purpose", p)} className="chip">
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--rule)] bg-[rgba(255,253,248,.7)]" data-open={more}>
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5">
          <span className="min-w-0">
            <span className="block text-[15.5px] font-medium text-[var(--ink)]">Title slide and college format</span>
            <span className="block text-[13px] text-[var(--muted)]">Name, roll no., guide, department, required sections</span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(29,25,19,.05)]">
            <ChevronDown className="chev h-[18px] w-[18px] text-[var(--muted)]" />
          </span>
        </button>
        <div className="fold" data-open={more} inert={!more}>
          <div>
            <div className="space-y-3 border-t border-[var(--rule)] p-4 sm:p-5">
              <input value={r.presenter.names} onChange={(e) => setP("names", e.target.value)} placeholder="Presented by (names)" aria-label="Presented by (names)" className={field} />
              {/* stacked on phones so "Course / semester" is never cut off */}
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <input value={r.presenter.rollNo} onChange={(e) => setP("rollNo", e.target.value)} placeholder="Roll no." aria-label="Roll no." className={field} />
                <input value={r.presenter.course} onChange={(e) => setP("course", e.target.value)} placeholder="Course / semester" aria-label="Course / semester" className={field} />
              </div>
              <input value={r.presenter.guide} onChange={(e) => setP("guide", e.target.value)} placeholder="Guide / supervisor" aria-label="Guide / supervisor" className={field} />
              <input value={r.presenter.department} onChange={(e) => setP("department", e.target.value)} placeholder="Department" aria-label="Department" className={field} />
              <input value={r.presenter.institute} onChange={(e) => setP("institute", e.target.value)} placeholder="College / university" aria-label="College / university" className={field} />
              <LogoPicker value={r.logoId} onChange={(id) => set("logoId", id)} />
              <textarea
                rows={4}
                value={r.formatNotes}
                onChange={(e) => setR((x) => ({ ...x, formatNotes: e.target.value }))}
                placeholder="Required format, if any (e.g. Introduction, Objectives, Methodology, Results, Conclusion, References in IEEE style)"
                aria-label="Required format"
                className={`${field} resize-none`}
                maxLength={2000}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="rounded-[var(--r-md)] border border-[#EBC3B6] bg-[var(--bad-soft)] px-4 py-3 text-[14px] text-[var(--bad)]">{error}</p>}

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--r-md)] border border-[var(--rule)] bg-[rgba(255,253,248,.7)] px-4 py-3.5 text-[14px] leading-snug text-[var(--ink)]">
        <input
          type="checkbox"
          className="check mt-px"
          checked={ageOk}
          onChange={(e) => {
            setAgeOk(e.target.checked);
            if (e.target.checked) localStorage.setItem(AGE_KEY, "1");
            else localStorage.removeItem(AGE_KEY);
          }}
        />
        <span>
          I am 18 or older. I understand my topic and details are processed by AI providers to make the presentation.
        </span>
      </label>

      <div className="space-y-3">
        <button type="submit" disabled={busy || r.topic.trim().length < 3 || !ageOk} className="btn btn-ink w-full !py-[17px] !text-[16px]">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {busy ? "Starting" : "Create presentation"}
          {!busy && <ArrowRight className="h-5 w-5" />}
        </button>
        <p className="text-center text-[13px] text-[var(--muted)]">Takes a few minutes. You can close the app while it works.</p>
      </div>
      <p className="border-t border-[var(--rule)] pt-4 text-center text-[12px] leading-relaxed text-[var(--faint)]">Privacy: your topic and the details you type are sent to AI model providers (for example Google Gemini and OpenRouter) only to make your deck. Free AI services may use what is sent to improve their models, so do not enter personal or confidential information.</p>
    </form>
  );
}

function LogoPicker({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [msg, setMsg] = useState("");
  const pick = async (f: File) => {
    setState("uploading");
    setPreview(URL.createObjectURL(f));
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/v3/uploads", { method: "POST", body: fd, headers: { "x-client-id": clientId() } }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok || !d.id) {
      setState("error");
      setMsg(d.error || "Upload failed. Try again.");
      setPreview(null);
      onChange(undefined);
      return;
    }
    setState("idle");
    onChange(d.id);
  };
  return (
    <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-dashed border-[var(--rule-2)] bg-[rgba(255,253,248,.85)] px-4 py-3">
      {preview && value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Logo" className="h-10 w-10 rounded-lg object-contain" />
      ) : null}
      <div className="min-w-0 flex-1 text-[14px]">
        <p className="font-medium text-[var(--ink)]">{value ? "Logo added" : "College logo (optional)"}</p>
        <p className="text-[12px] text-[var(--muted)]">{state === "uploading" ? "Uploading" : state === "error" ? msg : "The designer places it on the title slide"}</p>
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
            setPreview(null);
          }}
          className="press text-[14px] font-medium text-[var(--muted)]"
        >
          Remove
        </button>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="btn btn-ghost btn-sm">
          Choose
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
  );
}
