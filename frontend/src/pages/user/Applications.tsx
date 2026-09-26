import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { Application } from "@/types";
import { EmptyState, PageHeader, ProgressBar, StatusPill, formatDate } from "@/components/ui";

export default function Applications() {
  const { t } = useI18n();
  const [apps, setApps] = useState<Application[] | null>(null);
  useEffect(() => {
    api.get<Application[]>("/api/applications").then(setApps);
  }, []);
  return (
    <div>
      <PageHeader eyebrow="Tracker" title={t("applications")} subtitle="Every application you started, with its status and next step." />
      {apps && apps.length === 0 && <EmptyState icon={<FileText />} title="No applications yet">Start from the assistant or the schemes page.</EmptyState>}
      {!!apps?.length && (
        <div className="card divide-y divide-paper-300 overflow-hidden">
          {apps.map((a) => (
            <Link key={a.id} to={`/applications/${a.id}`} className="flex flex-col gap-3 px-4 py-4 hover:bg-paper-100 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-900">{a.scheme_name}</div>
                <div className="text-sm text-ink-500">
                  {a.reference_number ? `Ref ${a.reference_number} · ` : ""}Updated {formatDate(a.updated_at)}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:contents">
                <div className="flex flex-1 items-center gap-2 sm:w-56 sm:flex-none"><ProgressBar value={a.progress} /><span className="w-10 text-right text-sm font-semibold">{a.progress}%</span></div>
                <div className="sm:w-44 sm:text-right"><StatusPill status={a.status} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
