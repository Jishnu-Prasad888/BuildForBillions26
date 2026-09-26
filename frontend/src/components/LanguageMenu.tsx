import { Check, ChevronDown, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/i18n";
import type { Lang } from "@/types";

/** A compact language pill that opens a small menu (upwards, since it lives at the bottom of chat panels). */
export default function LanguageMenu({ value, onChange, label = "Speaking language" }: { value: Lang; onChange: (l: Lang) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        title="Language you will speak in"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
      >
        <Languages size={15} className="text-forest-700" aria-hidden />
        {current.native}
        <ChevronDown size={14} className={`text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[10rem] rounded-lg border border-paper-300 bg-white p-1 shadow-lift">
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === value}>
              <button
                type="button"
                onClick={() => { onChange(l.code); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                  l.code === value ? "bg-forest-50 text-forest-800" : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                <span>{l.native}<span className="ml-1.5 text-xs font-normal text-ink-400">{l.label}</span></span>
                {l.code === value && <Check size={15} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
