import { ArrowRight, FileText, MessageCircle, Plus, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { Application } from "@/types";
import { ApplicationCard } from "@/components/apps/WorkCard";
import { CardGridSkeleton, LoadError } from "@/components/apps/Skeleton";
import { bucketOf, isActive, nextAction, type Bucket } from "@/components/apps/status";
import { EmptyState, PageHeader, ProgressBar, Tabs } from "@/components/ui";

type Filter = "all" | Bucket;

/** The one application worth resuming: the most recently touched open one that has a form. */
function ResumeBanner({ app }: { app: Application }) {
  const na = nextAction(app);
  return (
    <section className="mb-6 overflow-hidden rounded-lg bg-forest-800 p-5 text-white shadow-card sm:p-6" aria-label="Pick up where you left off">
      <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-200">Pick up where you left off</div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="font-display text-xl font-bold leading-snug text-white sm:text-2xl">{app.scheme_name}</h2>
          <p className="mt-1 text-sm text-forest-100">{na.hint}</p>
          <div className="mt-3 flex max-w-md items-center gap-3">
            <ProgressBar value={app.progress} className="!bg-forest-900" />
            <span className="text-sm font-bold">{app.progress}%</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={na.to} className="btn bg-white text-forest-900 hover:bg-forest-50">{na.label} <ArrowRight size={16} /></Link>
          {na.assistTo && <Link to={na.assistTo} className="btn border border-forest-500 text-white hover:bg-forest-700"><Sparkles size={16} /> Help me fill</Link>}
        </div>
      </div>
    </section>
  );
}

export default function Applications() {
  const { t } = useI18n();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    setError(null);
    api.get<Application[]>("/api/applications").then(setApps).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const resume = apps?.find((a) => isActive(a) && a.form_id);
  const count = (f: Filter) => (apps ?? []).filter((a) => f === "all" || bucketOf(a.status) === f).length;
  const shown = (apps ?? []).filter((a) => filter === "all" || bucketOf(a.status) === filter);

  return (
    <div>
      <PageHeader eyebrow="Track" title={t("applications")}
        subtitle="Everything you have started, where it stands, and what to do next."
        actions={<>
          <Link to="/assistant" className="btn-secondary"><MessageCircle size={17} /> Ask the assistant</Link>
          <Link to="/forms" className="btn-primary"><Plus size={17} /> Start a new form</Link>
        </>} />

      {error ? <LoadError message={error} onRetry={load} /> : apps === null ? <CardGridSkeleton /> : apps.length === 0 ? (
        <EmptyState icon={<FileText size={28} />} title="No applications yet">
          <p>Choose a government form and the assistant will help you fill it, or ask it which scheme suits you.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/forms" className="btn-primary btn-sm"><Sparkles size={15} /> Browse forms</Link>
            <Link to="/assistant" className="btn-secondary btn-sm">Ask the assistant</Link>
            <Link to="/schemes" className="btn-ghost btn-sm">Browse schemes</Link>
          </div>
        </EmptyState>
      ) : (
        <>
          {resume && <ResumeBanner app={resume} />}
          <Tabs<Filter> value={filter} onChange={setFilter} tabs={[
            { id: "all", label: "All", count: count("all") },
            { id: "active", label: t("in_progress"), count: count("active") },
            { id: "submitted", label: "Submitted", count: count("submitted") },
            { id: "approved", label: "Approved", count: count("approved") },
          ]} />
          {shown.length === 0 ? <div className="mt-4"><EmptyState title="Nothing in this view" /></div> : (
            <div key={filter} className="stagger mt-4 grid gap-4 md:grid-cols-2">{shown.map((a) => <ApplicationCard key={a.id} app={a} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
