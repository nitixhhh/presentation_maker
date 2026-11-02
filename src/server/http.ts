import type { V3Request } from "@/engine-v3/types";

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);

/** Server-side validation of a generation request (never trust the client). */
export function parseV3Request(body: any): { ok: true; value: V3Request } | { ok: false; error: string } {
  const topic = clip(body?.topic, 300);
  if (!topic || topic.length < 3) return { ok: false, error: "Please enter a topic (at least 3 characters)." };
  const slideCount = Math.min(20, Math.max(4, Math.round(Number(body?.slideCount) || 8)));
  const language = ["English", "Hindi", "Hinglish"].includes(body?.language) ? body.language : "English";
  const im = body?.imageMode || body?.imageSource;
  const imageMode = im === "none" ? "none" : im === "ai-allowed" || im === "ai" ? "ai-allowed" : "real-first";
  const p = body?.presenter || {};
  const presenter = {
    names: clip(p.names, 300),
    rollNo: clip(p.rollNo, 120),
    department: clip(p.department, 160),
    institute: clip(p.institute, 200),
    guide: clip(p.guide, 200),
    course: clip(p.course, 160),
    date: clip(p.date, 60),
  };
  const hasPresenter = Object.values(presenter).some(Boolean);
  return {
    ok: true,
    value: {
      topic,
      audience: clip(body?.audience, 160),
      slideCount,
      language,
      purpose: clip(body?.purpose, 120),
      formatNotes: clip(body?.formatNotes, 2000),
      presenter: hasPresenter ? presenter : undefined,
      imageMode,
      styleHint: clip(body?.styleHint, 200),
      logoId: typeof body?.logoId === "string" && /^logo_[a-z0-9]{8,40}$/.test(body.logoId) ? body.logoId : undefined,
    },
  };
}
