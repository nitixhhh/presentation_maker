"use client";
import { useState } from "react";
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

export const field =
  "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-[15px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)] outline-none";
const label = "block text-[13px] font-medium text-[var(--muted)] mb-1.5";

export default function CreateForm({ onSubmit, busy, error }: { onSubmit: (r: CreateRequest) => void; busy: boolean; error: string | null }) {
  const [r, setR] = useState<CreateRequest>(EMPTY);
  const [more, setMore] = useState(false);
  // Gemini API terms: users must be 18+. Asked once per phone, remembered in localStorage.
  const [ageOk, setAgeOk] = useState(() => typeof window !== "undefined" && localStorage.getItem(AGE_KEY) === "1");
  const set = <K extends keyof CreateRequest>(k: K, v: CreateRequest[K]) => setR((x) => ({ ...x, [k]: v }));
  const setP = (k: keyof CreateRequest["presenter"], v: string) => setR((x) => ({ ...x, presenter: { ...x.presenter, [k]: v } }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (r.topic.trim().length >= 3 && ageOk && !busy) onSubmit({ ...r, ageConfirmed: true });
      }}
      className="space-y-5"
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
        <Select label="Slides" value={r.slideCount} onChange={(v) => set("slideCount", v)} options={[6, 8, 10, 12, 15, 18, 20].map((n) => ({ value: n, label: `${n} slides` }))} />
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
            <button
              type="button"
              key={p}
              onClick={() => set("purpose", p)}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-medium ${
                r.purpose === p ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-white text-[var(--muted)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white">
        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
          <span>
            <span className="block text-[15px] font-medium text-[var(--ink)]">Title slide and college format</span>
            <span className="block text-[13px] text-[var(--muted)]">Name, roll no., guide, department, required sections</span>
          </span>
          <ChevronDown className={`h-5 w-5 text-[var(--muted)] transition-transform ${more ? "rotate-180" : ""}`} />
        </button>
        {more && (
          <div className="space-y-3 border-t border-[var(--line)] p-4">
            <input value={r.presenter.names} onChange={(e) => setP("names", e.target.value)} placeholder="Presented by (names)" className={field} />
            <div className="grid grid-cols-2 gap-3">
              <input value={r.presenter.rollNo} onChange={(e) => setP("rollNo", e.target.value)} placeholder="Roll no." className={field} />
              <input value={r.presenter.course} onChange={(e) => setP("course", e.target.value)} placeholder="Course / semester" className={field} />
            </div>
            <input value={r.presenter.guide} onChange={(e) => setP("guide", e.target.value)} placeholder="Guide / supervisor" className={field} />
            <input value={r.presenter.department} onChange={(e) => setP("department", e.target.value)} placeholder="Department" className={field} />
            <input value={r.presenter.institute} onChange={(e) => setP("institute", e.target.value)} placeholder="College / university" className={field} />
            <LogoPicker value={r.logoId} onChange={(id) => set("logoId", id)} />
            <textarea
              rows={3}
              value={r.formatNotes}
              onChange={(e) => set("formatNotes", e.target.value)}
              placeholder="Required format, if any (e.g. Introduction, Objectives, Methodology, Results, Conclusion, References in IEEE style)"
              className={`${field} resize-none`}
              maxLength={2000}
            />
          </div>
        )}
      </div>

      {error && <p className="rounded-xl border border-[#F3C7C7] bg-[#FDF2F2] px-4 py-3 text-[14px] text-[#9B1C1C]">{error}</p>}

      <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[14px] leading-snug text-[var(--ink)]">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
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

      <button
        type="submit"
        disabled={busy || r.topic.trim().length < 3 || !ageOk}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-4 text-[16px] font-semibold text-white shadow-sm disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {busy ? "Starting" : "Create presentation"}
        {!busy && <ArrowRight className="h-5 w-5" />}
      </button>
      <p className="text-center text-[13px] text-[var(--muted)]">Takes a few minutes. You can close the app while it works.</p>
      <p className="text-center text-[12px] text-[var(--faint)]">Privacy: your topic and the details you type are sent to AI model providers (for example Google Gemini and OpenRouter) only to make your deck. Free AI services may use what is sent to improve their models, so do not enter personal or confidential information.</p>
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
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-white px-3.5 py-3">
      {preview && value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Logo" className="h-10 w-10 rounded object-contain" />
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
          className="text-[14px] font-medium text-[var(--muted)]"
        >
          Remove
        </button>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-[var(--chip)] px-3 py-2 text-[14px] font-medium text-[var(--ink)]">
          Choose
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
  );
}
