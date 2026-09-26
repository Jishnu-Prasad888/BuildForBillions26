import { ChevronRight, FileText, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { Application } from "@/types";
import { EmptyState, PageHeader, ProgressBar, SkeletonList, StatusPill, Tabs, formatDate } from "@/components/ui";

const ACTIVE = ["DRAFT", "IN_PROGRESS", "DOCUMENTS_REQUIRED"];
type Filter = "all" | "active" | "submitted";

export default function Applications() {
  const { t } = useI18n();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    api.get<Application[]>("/api/applications").then(setApps);
  }, []);

  const list = apps ?? [];
  const active = list.filter((a) => ACTIVE.includes(a.status));
  const submitted = list.filter((a) => !ACTIVE.includes(a.status));
  const shown = filter === "active" ? active : filter === "submitted" ? submitted : list;

  return (
    <div>
      <PageHeader eyebrow="Tracker" title={t("applications")} subtitle="Every application you started, with its status and next step."
        actions={<Link to="/assistant" className="btn-secondary"><MessageCircle size={17} /> Start a new one</Link>} />
      {apps === null ? <SkeletonList rows={4} /> : apps.length === 0 ? (
        <EmptyState icon={<FileText size={22} />} title="No applications yet">Start from the <Link to="/assistant" className="link">assistant</Link> or the <Link to="/schemes" className="link">schemes page</Link>.</EmptyState>
      ) : (
        <>
          <Tabs value={filter} onChange={setFilter} tabs={[
            { id: "all", label: "All", count: list.length },
            { id: "active", label: t("in_progress"), count: active.length },
            { id: "submitted", label: "Submitted", count: submitted.length },
          ]} />
          {shown.length === 0 ? (
            <div className="mt-4"><EmptyState icon={<FileText size={22} />} title="Nothing here yet" /></div>
          ) : (
            <div key={filter} className="stagger mt-4 space-y-3">
              {shown.map((a) => (
                <Link key={a.id} to={`/applications/${a.id}`} className="card-link group flex items-center gap-4 p-4 sm:px-5">
                  <span className={`hidden h-11 w-11 flex-none items-center justify-center rounded-lg sm:flex ${a.progress >= 100 ? "bg-leaf-50 text-leaf" : "bg-forest-50 text-forest-700"}`}><FileText size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-ink-900">{a.scheme_name}</span>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-ink-500">
                      {a.reference_number ? `Ref ${a.reference_number} · ` : ""}Updated {formatDate(a.updated_at)}
                      {a.next_section && a.progress < 100 ? ` · Next: ${a.next_section}` : ""}
                    </div>
                    <div className="mt-2.5 flex max-w-md items-center gap-2"><ProgressBar value={a.progress} /><span className="w-10 text-right text-sm font-semibold text-ink-600">{a.progress}%</span></div>
                  </div>
                  <ChevronRight size={20} className="flex-none text-ink-300 transition-all group-hover:translate-x-1 group-hover:text-forest-700" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
