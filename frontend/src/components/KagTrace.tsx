import { ChevronRight } from "lucide-react";
import { useState } from "react";

/* Shows the KAG pipeline that produced an answer — understanding → graph → documents → LLM → validated citations. */
export default function KagTrace({ meta, cited }: { meta: Record<string, any>; cited: number }) {
  const [open, setOpen] = useState(false);
  const u = meta?.understanding;
  if (!u) return null;
  const steps = [
    { k: "Understood", v: `${({ en: "English", hi: "Hindi", kn: "Kannada" } as any)[u.language] ?? u.language}${u.life_event ? ` · life event: ${u.life_event.name}` : ""} · intent: ${u.intent}` },
    { k: "Knowledge graph", v: u.life_event || (u.scheme_codes ?? []).length ? `${(meta.scheme_cards ?? []).length || (u.scheme_codes ?? []).length} scheme(s) via Neo4j` : "no direct graph match" },
    { k: "Documents", v: `${meta.retrieved_count ?? "–"} candidates · vector + keyword, ranked` },
    { k: "Generation", v: meta.mode === "llm" ? "LLM with retrieved context only" : meta.mode === "fallback" ? "deterministic composer (LLM offline)" : "rule-based" },
    { k: "Citations", v: `${cited} validated by backend${meta.grounded === false ? " · ⚠ unverified" : ""}` },
  ];
  return (
    <div className="mt-2 text-xs">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 font-semibold text-ink-500 hover:text-ink-800" aria-expanded={open}>
        <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} /> How this answer was grounded
      </button>
      {open && (
        <ol className="mt-2 grid gap-1.5 rounded-lg border border-paper-300 bg-paper-100 p-3 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.k} className="relative">
              <div className="flex items-center gap-1.5 font-bold text-ink-700"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-forest-800 text-[0.6rem] text-white">{i + 1}</span>{s.k}</div>
              <div className="mt-0.5 text-ink-600">{s.v}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
