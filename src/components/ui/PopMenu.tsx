"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Small token-style menu that pops from the point it was tapped (spring scale .9 -> 1, slight un-blur).
 * Opens downward when it fits; otherwise flips upward if there is more room above, and never runs past the
 * screen edge: the list gets a max height and scrolls (so "20 slides" stays reachable on a 390x844 phone).
 */
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
  const [place, setPlace] = useState<{ up: boolean; max: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
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

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = wrap.current?.getBoundingClientRect();
      const ul = list.current;
      if (!r || !ul) return;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const gap = 8 + 12; // offset from the button + breathing room from the screen edge
      const below = vh - r.bottom - gap;
      const above = r.top - gap;
      const need = ul.scrollHeight;
      const up = need > below && above > below;
      setPlace({ up, max: Math.max(120, Math.floor(up ? above : below)) });
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
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
          ref={list}
          role="listbox"
          aria-label={label}
          className={`glass menu pop absolute left-0 z-30 min-w-[150px] overflow-y-auto overscroll-contain rounded-[18px] p-1.5 ${place?.up ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}`}
          style={{
            transformOrigin: place?.up ? `${ox}px calc(100% + 8px)` : `${ox}px -8px`,
            maxHeight: place ? place.max : undefined,
            visibility: place ? undefined : "hidden",
          }}
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
