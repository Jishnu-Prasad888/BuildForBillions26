import { ArrowRight, Building2, FileCheck2, Landmark } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import type { Application, Evidence, SchemeCard as S } from "@/types";
import { useI18n } from "@/i18n";
import { Spinner } from "./ui";

export default function SchemeCard({ scheme, evidence = [], onCite, compact = false }: { scheme: S; evidence?: Evidence[]; onCite?: (id: string) => void; compact?: boolean }) {
  const nav = useNavigate();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const factIdx = evidence.findIndex((e) => e.id === scheme.fact_id);

  const apply = async () => {
    setBusy(true);
    try {
      const related = evidence.filter((e) => e.scheme_code === scheme.code || (e.type === "chunk" && (e as any).scheme_codes?.includes(scheme.code)));
      const app = await api.post<Application>("/api/applications", { scheme_code: scheme.code, evidence: related });
      nav(scheme.form_id ? `/applications/${app.id}/form` : `/applications/${app.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold leading-snug text-ink-900">{scheme.display_name}</div>
          {scheme.department && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
              <Building2 size={13} /> {scheme.department}
            </div>
          )}
        </div>
        {factIdx >= 0 && (
          <button className="cite" onClick={() => onCite?.(scheme.fact_id)} title="Graph evidence">
            {factIdx + 1}
          </button>
        )}
      </div>
      {!compact && scheme.summary && <p className="mt-2 text-sm text-ink-700">{scheme.summary}</p>}
      {scheme.benefit && (
        <div className="mt-2 rounded-md bg-leaf-50 px-2.5 py-1.5 text-sm text-leaf-700">
          <Landmark size={14} className="mr-1 inline -translate-y-px" />
          {scheme.benefit}
        </div>
      )}
      {!compact && scheme.documents.length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-1">Required documents</div>
          <ul className="space-y-0.5 text-sm text-ink-700">
            {scheme.documents.map((d) => (
              <li key={d.code} className="flex gap-1.5">
                <FileCheck2 size={15} className="mt-0.5 flex-none text-ink-400" /> {d.display_name}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        <button className="btn-accent btn-sm" onClick={apply} disabled={busy}>
          {busy ? <Spinner /> : null}
          {scheme.form_id ? t("apply") : t("track")} <ArrowRight size={15} />
        </button>
        <button className="btn-ghost btn-sm" onClick={() => nav(`/schemes/${scheme.code}`)}>
          Details
        </button>
        {scheme.form_id && <span className="text-xs text-ink-500">Guided form available (demo)</span>}
      </div>
    </div>
  );
}
