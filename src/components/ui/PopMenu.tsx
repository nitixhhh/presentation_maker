"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/** Small token-style menu that pops from the point it was tapped (spring scale .9 -> 1, slight un-blur). */
export default function PopMenu<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [ox, setOx] = useState(24);
  const wrap = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label}`}
        onPointerDown={(e) => setOx(e.nativeEvent.offsetX || 24)}
        onClick={() => setOpen((o) => !o)}
        className="press inline-flex items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[rgba(255,253,248,.85)] px-3 py-[7px] text-[13.5px] font-medium text-[var(--ink-2)]"
      >
        {current?.label}
        <ChevronDown className="chev h-3.5 w-3.5 text-[var(--muted)]" data-open={open} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="glass menu pop absolute left-0 top-[calc(100%+8px)] z-30 min-w-[150px] rounded-[18px] p-1.5"
          style={{ transformOrigin: `${ox}px -8px` }}
        >
          {options.map((o) => (
            <li key={String(o.value)}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14.5px] hover:bg-[var(--accent-soft)] ${
                  o.value === value ? "font-semibold text-[var(--accent-ink)]" : "text-[var(--ink)]"
                }`}
              >
                {o.label}
                {o.value === value && <Check className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
