import { ExternalLink, ListChecks, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { SchemeCard as S } from "@/types";
import SchemeCard from "@/components/SchemeCard";
import GraphView from "@/components/GraphView";
import { PageHeader, Spinner } from "@/components/ui";

export default function SchemeDetail() {
  const { code } = useParams();
  const { lang } = useI18n();
  const [s, setS] = useState<S | null>(null);
  useEffect(() => {
    api.get<S>(`/api/schemes/${code}?lang=${lang}`).then(setS);
  }, [code, lang]);
  if (!s) return <Spinner className="h-6 w-6" />;
  return (
    <div>
      <Link to="/schemes" className="text-sm font-semibold text-ink-600">← All schemes</Link>
      <PageHeader title={s.display_name} subtitle={s.summary} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ListChecks size={20} className="text-saffron-600" /> Eligibility rules</h2>
            <ul className="space-y-2">
              {s.rules.map((r) => (
                <li key={r.code} className="flex gap-3 rounded-lg bg-paper-100 px-3 py-2"><span className="font-mono text-xs text-ink-400">{r.code}</span><span>{r.text}</span></li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">How it connects (knowledge graph)</h2>
            {s.graph && <GraphView graph={s.graph} />}
          </section>
        </div>
        <div className="space-y-4">
          <SchemeCard scheme={s} compact />
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ShieldCheck size={18} className="text-leaf" /> Sources</h2>
            <ul className="space-y-2 text-sm">
              {s.sources?.map((d) => (
                <li key={d.id}>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-ink-500">{d.publisher}{d.is_demo && <span className="chip ml-1 bg-saffron-50 text-saffron-700">demo summary</span>}</div>
                  {d.url && <a className="inline-flex items-center gap-1 text-ink-700 underline decoration-saffron" href={d.url} target="_blank" rel="noreferrer">{d.url} <ExternalLink size={12} /></a>}
                </li>
              ))}
            </ul>
            {s.portal?.url && <a href={s.portal.url} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-4 w-full">Official portal <ExternalLink size={14} /></a>}
          </section>
        </div>
      </div>
    </div>
  );
}
