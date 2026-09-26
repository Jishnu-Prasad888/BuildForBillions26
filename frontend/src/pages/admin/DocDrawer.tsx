import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { IngestionJob, KnowledgeDoc } from "@/types";
import { Drawer, Spinner, StatusPill, formatDate } from "@/components/ui";
import PipelineViz from "./PipelineViz";

interface Chunk {
  chunk_id: string; document_id: string; chunk_index: number; content: string; section?: string | null; page?: number | null;
  language: string; scheme_codes: string[]; content_hash: string; embedding_model?: string | null; source_url?: string | null;
  source_title: string; publisher: string; published_date?: string | null; retrieved_at: string;
}
type Detail = KnowledgeDoc & { chunks: Chunk[]; jobs: IngestionJob[] };

export default function DocDrawer({ docId, onClose, onChanged }: { docId: string | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setD(null);
    if (docId) api.get<Detail>(`/api/admin/documents/${docId}`).then(setD);
  }, [docId]);

  return (
    <Drawer open={!!docId} onClose={onClose} title="Document" width="max-w-3xl">
      {!d ? <Spinner className="h-6 w-6" /> : (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-bold">{d.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
              <StatusPill status={d.status} /> {d.publisher} {d.is_demo && <span className="chip bg-amber-50 text-amber-700">demo</span>}
              {d.source?.is_official && <span className="chip bg-leaf-50 text-leaf-700">official source</span>}
            </div>
            {d.source_url && <a href={d.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm underline decoration-saffron">{d.source_url} <ExternalLink size={12} /></a>}
          </div>
          <dl className="card grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
            <div><dt className="eyebrow">Chunks</dt><dd className="font-semibold">{d.chunk_count}</dd></div>
            <div><dt className="eyebrow">Language</dt><dd className="font-semibold">{d.language}</dd></div>
            <div><dt className="eyebrow">Kind</dt><dd className="font-semibold">{d.kind}</dd></div>
            <div><dt className="eyebrow">Published</dt><dd className="font-semibold">{d.published_date || "—"}</dd></div>
            <div className="col-span-2"><dt className="eyebrow">Linked schemes (graph)</dt><dd className="font-semibold">{d.scheme_codes.join(", ") || "—"}</dd></div>
            <div className="col-span-2"><dt className="eyebrow">Content hash</dt><dd className="truncate font-mono text-xs">{d.content_hash}</dd></div>
          </dl>
          {d.jobs[0] && (
            <div>
              <div className="eyebrow mb-2">Latest ingestion · {formatDate(d.jobs[0].created_at, true)}</div>
              <PipelineViz status={d.jobs[0].status} stages={d.jobs[0].stages} />
              {d.jobs[0].error && <p className="mt-2 text-sm text-brick">{d.jobs[0].error}</p>}
            </div>
          )}
          <div className="flex gap-2">
            {d.kind !== "seed" && <button className="btn-secondary btn-sm" onClick={async () => { await api.post(`/api/admin/documents/${d.id}/reindex`); onChanged(); onClose(); }}><RefreshCw size={14} /> Re-index</button>}
            <button className="btn-danger btn-sm" onClick={async () => { if (confirm("Delete this document and all its chunks?")) { await api.del(`/api/admin/documents/${d.id}`); onChanged(); onClose(); } }}><Trash2 size={14} /> Delete</button>
          </div>
          <div>
            <div className="eyebrow mb-2">Chunks + provenance metadata</div>
            <div className="space-y-2">
              {d.chunks.map((c) => (
                <div key={c.chunk_id} className="card overflow-hidden">
                  <button className="flex w-full items-start gap-3 p-3 text-left" onClick={() => setOpen(open === c.chunk_id ? null : c.chunk_id)}>
                    <span className="font-mono text-xs font-bold text-saffron-700">{c.chunk_id}</span>
                    <span className="flex-1 text-sm"><b>{c.section || "—"}</b>{c.page ? ` · p.${c.page}` : ""}<span className="line-clamp-2 text-ink-600">{c.content}</span></span>
                  </button>
                  {open === c.chunk_id && (
                    <div className="border-t border-paper-300 bg-paper-100 p-3">
                      <p className="whitespace-pre-line text-sm">{c.content}</p>
                      <pre className="mt-3 overflow-x-auto rounded bg-ink-900 p-3 text-xs text-ink-100">{JSON.stringify({
                        chunk_id: c.chunk_id, document_id: c.document_id, source_url: c.source_url, source_title: c.source_title, publisher: c.publisher,
                        section: c.section, page: c.page, language: c.language, published_date: c.published_date, retrieved_at: c.retrieved_at,
                        content_hash: c.content_hash, embedding_model: c.embedding_model, scheme_codes: c.scheme_codes,
                      }, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
