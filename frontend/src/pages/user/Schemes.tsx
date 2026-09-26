import { MessageCircle, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { SchemeCard as S } from "@/types";
import SchemeCard from "@/components/SchemeCard";
import { EmptyState, PageHeader } from "@/components/ui";

export default function Schemes() {
  const { lang, t } = useI18n();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [schemes, setSchemes] = useState<S[] | null>(null);
  const [q, setQ] = useState("");
  const formOnly = params.get("form") === "1";
  const setFormOnly = (v: boolean) => setParams(v ? { form: "1" } : {}, { replace: true });

  useEffect(() => {
    api.get<S[]>(`/api/schemes?lang=${lang}`).then(setSchemes);
  }, [lang]);

  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return (schemes ?? []).filter((x) => (!formOnly || x.form_id) && (!s || `${x.display_name} ${x.name} ${x.summary}`.toLowerCase().includes(s)));
  }, [schemes, q, formOnly]);

  const filters = [
    { on: !formOnly, label: "All schemes", count: schemes?.length ?? 0, set: () => setFormOnly(false) },
    { on: formOnly, label: "With guided form", count: schemes?.filter((x) => x.form_id).length ?? 0, set: () => setFormOnly(true) },
  ];

  return (
    <div>
      <PageHeader eyebrow="From the knowledge graph" title={t("schemes")}
        subtitle={formOnly ? "Choose a scheme with a guided form. The assistant will help you fill it field by field." : "Government schemes linked to life events. Not sure which applies? Describe your situation to the assistant."}
        actions={<button className="btn-accent" onClick={() => nav("/assistant")}><MessageCircle size={17} /> {t("talk_assistant")}</button>} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-10 pr-10" placeholder="Search schemes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search schemes" />
          {q && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-800" onClick={() => setQ("")} aria-label="Clear search"><X size={16} /></button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter schemes">
          {filters.map((f) => (
            <button key={f.label} onClick={f.set} aria-pressed={f.on}
              className={`inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-all ${f.on ? "border-forest-800 bg-forest-800 text-white shadow-sm" : "border-paper-300 bg-white text-ink-700 hover:border-forest-200 hover:bg-forest-50"}`}>
              {f.label}
              <span className={`rounded-full px-1.5 text-[0.7rem] ${f.on ? "bg-white/20" : "bg-ink-100 text-ink-600"}`}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {schemes === null ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-56" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState icon={<SearchX size={22} />} title="No schemes match">
          Try another word, or <button className="link" onClick={() => nav(`/assistant${q ? `?q=${encodeURIComponent(q)}` : ""}`)}>ask the assistant</button> instead.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-500">{shown.length} scheme{shown.length === 1 ? "" : "s"}</p>
          {/* Keyed on the filter so the cards replay their entrance when it changes. */}
          <div key={`${formOnly}`} className="stagger grid gap-4 md:grid-cols-2">
            {shown.map((s) => <SchemeCard key={s.code} scheme={s} />)}
          </div>
        </>
      )}
    </div>
  );
}
