"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QA: { q: string; a: React.ReactNode }[] = [
  { q: "Preview sach me free hai?", a: "Haan. Poori deck watermark ke saath free dekh sakte ho. Pay tabhi karo jab clean PDF aur editable PPTX chahiye." },
  { q: "Kitna time lagta hai?", a: "Aam taur pe 6 se 10 minute. Rush time pe thoda zyada. App band kar do, deck server pe banti rehti hai aur My decks me mil jaayegi." },
  { q: "Hindi ya Hinglish me ban sakti hai?", a: "Haan. English, Hindi aur Hinglish, teeno me." },
  { q: "College ka title slide aur format?", a: "Naam, roll no., guide, department, college aur logo do, title slide waise hi banegi. Required sections (Introduction, Methodology, References) bhi likh sakte ho." },
  { q: "PowerPoint edit kar sakte hain?", a: "Haan, PPTX fully editable hai. Unlock ke baad 2 slides free me dobara banwa sakte ho: slide chuno, bolo kya badalna hai." },
  { q: "Facts kahan se aate hain?", a: "Real sources padh ke, aur references last slide pe milte hain. Phir bhi submit karne se pehle ek baar padh lena. AI se bhi galti ho sakti hai." },
  {
    q: "Mera data safe hai?",
    a: (
      <>
        Google login sirf aapke account aur decks ke liye hai. Topic aur details AI models ko sirf deck banane ke liye bheje jaate hain, isliye personal ya confidential info mat daalo.{" "}
        <a href="/privacy" className="font-medium text-[var(--accent-ink)] underline decoration-[var(--rule-2)] underline-offset-4">
          Privacy padho
        </a>
      </>
    ),
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="panel divide-y divide-[var(--rule)] rounded-[var(--r-lg)]">
      {QA.map((x, i) => {
        const on = open === i;
        return (
          <div key={x.q} data-open={on}>
            <button
              type="button"
              aria-expanded={on}
              onClick={() => setOpen(on ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-[18px] text-left text-[16px] font-medium text-[var(--ink)] sm:px-6"
            >
              {x.q}
              <ChevronDown className="chev h-5 w-5 shrink-0 text-[var(--muted)]" />
            </button>
            <div className="fold" data-open={on} inert={!on}>
              <div>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-[var(--muted)] sm:px-6">{x.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
