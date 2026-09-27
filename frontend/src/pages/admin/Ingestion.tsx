import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { IngestionJob } from "@/types";
import { EmptyState, PageHeader, SkeletonList, StatusPill, formatDate } from "@/components/ui";
import PipelineViz from "./PipelineViz";

export default function Ingestion() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api.get<IngestionJob[]>("/api/admin/ingestion").then((r) => { setJobs(r); setLoaded(true); });
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Ingestion" subtitle="Every upload and web fetch, stage by stage: Uploaded → Extracting → Chunking → Embedding → Indexing → Complete." />
      {!loaded ? (
        <SkeletonList rows={4} className="h-16" />
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Inbox size={22} />} title="No ingestion jobs yet">
          Upload a document or add a website source to see it move through the pipeline here.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="card">
              <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50" onClick={() => setOpen(open === j.id ? null : j.id)}>
                <span className="min-w-[220px] flex-1 font-medium text-ink-900">{j.title}</span>
                <span className="chip bg-ink-100 text-ink-600">{j.kind}</span>
                <span className="text-sm text-ink-500">{formatDate(j.created_at, true)}</span>
                {j.detail?.chunks != null && <span className="text-sm text-ink-600">{j.detail.chunks} chunks</span>}
                <StatusPill status={j.status} />
              </button>
              {open === j.id && (
                <div className="border-t border-paper-300 bg-paper-100 p-4">
                  <PipelineViz status={j.status} stages={j.stages} />
                  {j.error && <p className="mt-3 text-sm text-brick">{j.error}</p>}
                  {Object.keys(j.detail).length > 0 && <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100">{JSON.stringify(j.detail, null, 2)}</pre>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
