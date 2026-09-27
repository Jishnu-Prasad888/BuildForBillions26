import { ArrowLeft, ExternalLink, ListChecks, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { SchemeCard as S } from "@/types";
import SchemeCard from "@/components/SchemeCard";
import GraphView from "@/components/GraphView";
import { LoadError, Skeleton } from "@/components/apps/Skeleton";
import { PageHeader } from "@/components/ui";

function DetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

export default function SchemeDetail() {
  const { code } = useParams();
  const { lang } = useI18n();
  const [s, setS] = useState<S | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.get<S>(`/api/schemes/${code}?lang=${lang}`).then(setS).catch((e) => setError(e.message));
  }, [code, lang]);
  useEffect(load, [load]);

  if (error && !s) return <LoadError message={error} onRetry={load} />;
  if (!s) return <DetailSkeleton />;
  return (
    <div>
      <Link to="/schemes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"><ArrowLeft size={15} /> All schemes</Link>
      <PageHeader title={s.display_name} subtitle={s.summary} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-4 flex items-center gap-2"><ListChecks size={19} className="text-forest-600" /> Eligibility rules</h2>
            <ul className="space-y-2">
              {s.rules.map((r) => (
                <li key={r.code} className="flex gap-3 rounded-lg bg-paper-100 px-3.5 py-2.5 text-[0.95rem] text-ink-800"><span className="flex-none pt-0.5 font-mono text-xs text-ink-500">{r.code}</span><span>{r.text}</span></li>
              ))}
            </ul>
          </section>
          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-4">How it connects (knowledge graph)</h2>
            {s.graph && <GraphView graph={s.graph} />}
          </section>
        </div>
        <div className="space-y-4">
          <SchemeCard scheme={s} compact />
          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-leaf" /> Sources</h2>
            <ul className="space-y-3 text-sm">
              {s.sources?.map((d) => (
                <li key={d.id}>
                  <div className="font-medium text-ink-900">{d.title}</div>
                  <div className="text-ink-500">{d.publisher}{d.is_demo && <span className="chip ml-1 bg-saffron-50 text-saffron-700">demo summary</span>}</div>
                  {d.url && <a className="link inline-flex max-w-full items-center gap-1 break-all" href={d.url} target="_blank" rel="noreferrer">{d.url} <ExternalLink size={12} className="flex-none" /></a>}
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
