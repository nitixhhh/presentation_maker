"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Custom dropdown (no native OS picker). Desktop: popover under the field. Phones: bottom sheet with
 * large touch targets. Keyboard: Enter/Space/ArrowDown opens, arrows move, Enter selects, Esc closes.
 */
export default function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  id,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  label?: string;
  id?: string;
}) {
  const auto = useId();
  const fieldId = id || auto;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [ox, setOx] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    setSheet(window.matchMedia("(max-width: 640px)").matches);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (wrap.current && !wrap.current.contains(t) && !sheetRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open, options, value]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") setOpen(false);
  };

  const items = (
    <ul ref={list} role="listbox" id={`${fieldId}-list`} aria-labelledby={label ? `${fieldId}-label` : undefined} tabIndex={-1} className="max-h-[50vh] overflow-auto py-1.5">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <li
            key={String(o.value)}
            id={`${fieldId}-opt-${i}`}
            data-i={i}
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(i)}
            className={`mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3.5 ${sheet ? "py-3.5 text-[16px]" : "py-2.5 text-[15px]"} ${
              i === active ? "bg-[var(--accent-soft)]" : ""
            } ${selected ? "font-semibold text-[var(--accent-ink)]" : "text-[var(--ink)]"}`}
          >
            <span>
              {o.label}
              {o.hint && <span className="block text-[13px] font-normal text-[var(--muted)]">{o.hint}</span>}
            </span>
            {selected && <Check className="h-4 w-4 shrink-0" />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={wrap} className="relative">
      {label && (
        <span id={`${fieldId}-label`} className="label">
          {label}
        </span>
      )}
      <button
        ref={btn}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${fieldId}-list`}
        aria-activedescendant={open ? `${fieldId}-opt-${active}` : undefined}
        aria-labelledby={label ? `${fieldId}-label ${fieldId}` : undefined}
        onPointerDown={(e) => setOx(e.nativeEvent.offsetX)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className="field flex items-center justify-between gap-2 text-left focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_4px_var(--accent-ring)]"
      >
        <span className="truncate">{current?.label ?? "Select"}</span>
        <ChevronDown className="chev h-4 w-4 shrink-0 text-[var(--muted)]" data-open={open} />
      </button>
      {open &&
        (sheet ? (
          // portal: a blurred/animated ancestor would otherwise become the containing block of this fixed sheet
          createPortal(
            <div ref={sheetRef} className="scrim-in fixed inset-0 z-50 flex items-end bg-[rgba(29,25,19,.28)]" onKeyDown={onKey} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
              <div className="sheet-up w-full rounded-t-[var(--r-xl)] border-t border-[rgba(255,255,255,.8)] bg-[var(--card)] px-1 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]">
                <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[var(--rule-2)]" />
                {label && <p className="eyebrow px-5 pb-1 pt-3.5">{label}</p>}
                {items}
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className="glass menu pop absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-[20px]" style={{ transformOrigin: `${ox ?? 40}px -10px` }}>
            {items}
          </div>
        ))}
    </div>
  );
}
