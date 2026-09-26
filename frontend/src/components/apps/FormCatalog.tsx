import { ArrowRight, Building2, Landmark, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { Application, FormDef, SchemeCard } from "@/types";
import { ErrorNote, Spinner } from "@/components/ui";
import { CardGridSkeleton, LoadError } from "./Skeleton";
import { isActive } from "./status";
import { useStartApplication } from "./useStartApplication";

function SchemeFormCard({ scheme, existing, size, busy, onStart }: {
  scheme: SchemeCard; existing?: Application; size?: { sections: number; fields: number }; busy: boolean; onStart: (assist: boolean) => void;
}) {
  const guided = !!scheme.form_id;
  const docs = scheme.documents.map((d) => d.display_name);
  return (
    <article className="card flex flex-col gap-3 p-4 transition-shadow hover:shadow-lift sm:p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${guided ? "bg-forest-800 text-white" : "bg-forest-50 text-forest-700"}`}>
          {guided ? <Sparkles size={20} /> : <Landmark size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.05rem] font-bold leading-snug text-ink-900">{scheme.display_name}</h3>
          {scheme.department && <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500"><Building2 size={13} /> {scheme.department}</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {guided ? (
          <>
            <span className="chip bg-forest-50 text-forest-700 ring-1 ring-forest-100"><Sparkles size={12} /> AI helps you fill this</span>
            {size && <span className="chip bg-ink-100 text-ink-700">{size.fields} fields · {size.sections} sections</span>}
          </>
        ) : (
          <span className="chip bg-ink-100 text-ink-700">Applied for on the official portal</span>
        )}
        {existing && <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-100">{guided ? `In progress · ${existing.progress}%` : "Tracking"}</span>}
      </div>
      {scheme.summary && <p className="line-clamp-3 text-sm text-ink-700">{scheme.summary}</p>}
      {docs.length > 0 && (
        <p className="text-xs text-ink-500"><span className="font-semibold text-ink-600">Keep ready:</span> {docs.slice(0, 3).join(", ")}{docs.length > 3 ? ` +${docs.length - 3} more` : ""}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <button className={`btn-sm ${guided ? "btn-accent" : "btn-primary"}`} disabled={busy} onClick={() => onStart(true)}>
          {busy ? <Spinner /> : guided ? <Sparkles size={15} /> : null}
          {guided ? (existing ? "Continue with assistant" : "Fill with AI assistant") : existing ? "Open tracker" : "Track this application"}
          {!busy && !guided && <ArrowRight size={15} />}
        </button>
        <Link to={`/schemes/${scheme.code}`} className="btn-ghost btn-sm">Details</Link>
      </div>
    </article>
  );
}

/**
 * The government forms a citizen can start, taken from the same schemes as /applications.
 * Guided forms are filled with the assistant; the rest are tracked here. `leading` (the upload card) sits first in the guided group.
 */
export default function FormCatalog({ apps, leading }: { apps: Application[] | null; leading?: ReactNode }) {
  const { lang } = useI18n();
  const { start, busy, error: startError } = useStartApplication();
  const [schemes, setSchemes] = useState<SchemeCard[] | null>(null);
  const [sizes, setSizes] = useState<Record<string, { sections: number; fields: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.get<SchemeCard[]>(`/api/schemes?lang=${lang}`).then(async (list) => {
      setSchemes(list);
      // Field counts are a nicety; a failure here just hides the chip.
      const ids = [...new Set(list.map((s) => s.form_id).filter((x): x is string => !!x))];
      const defs = await Promise.all(ids.map((id) => api.get<FormDef>(`/api/schemes/forms/${id}`).then((f) => [id, f] as const).catch(() => null)));
      setSizes(Object.fromEntries(defs.flatMap((d) => (d && Array.isArray(d[1].sections) ? [[d[0], { sections: d[1].sections.length, fields: d[1].sections.reduce((n, s) => n + s.fields.length, 0) }]] : []))));
    }).catch((e) => setError(e.message));
  }, [lang]);
  useEffect(() => { load(); }, [load]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!schemes) return <CardGridSkeleton count={3} />;

  const open = (code: string) => apps?.find((a) => a.scheme_code === code && isActive(a));
  const card = (s: SchemeCard) => (
    <SchemeFormCard key={s.code} scheme={s} existing={open(s.code)} size={s.form_id ? sizes[s.form_id] : undefined} busy={busy === s.code} onStart={(assist) => start(s, assist)} />
  );
  const guided = schemes.filter((s) => s.form_id);
  const portal = schemes.filter((s) => !s.form_id);

  return (
    <div className="space-y-6">
      {startError && <ErrorNote>{startError}</ErrorNote>}
      <div>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-700">Guided forms</h3>
        <p className="mb-3 text-sm text-ink-600">The assistant explains each field, takes your answers by voice or typing, and fills the form with you.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {leading}
          {guided.map(card)}
        </div>
      </div>
      {portal.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-700">Apply on the official portal</h3>
          <p className="mb-3 text-sm text-ink-600">These are applied for on the government's own site. Track them here and keep their documents and notes together.</p>
          <div className="grid gap-4 md:grid-cols-2">{portal.map(card)}</div>
        </div>
      )}
    </div>
  );
}
