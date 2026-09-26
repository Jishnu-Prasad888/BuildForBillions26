import { Search, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import type { Evidence, IngestionJob, KnowledgeDoc } from "@/types";
import { useJobPolling } from "@/hooks/useJobPolling";
import Markdown, { citationOrderFrom } from "@/components/Markdown";
import { PageHeader, Spinner, StatusPill } from "@/components/ui";
import UploadModal from "./UploadModal";
import PipelineViz from "./PipelineViz";
import DocDrawer from "./DocDrawer";

interface KagResult {
  answer?: string;
  citations?: string[];
  evidence?: Evidence[];
  retrieved: (Evidence & { relevant?: boolean })[];
  understanding: Record<string, any>;
  retrieval: Record<string, any>;
  mode?: string;
}

export default function KnowledgeBase() {
  const [upload, setUpload] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [doc, setDoc] = useState<KnowledgeDoc | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const job = useJobPolling(jobId);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<KagResult | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      setRes(await api.post<KagResult>("/api/kag/query", { question: q, generate: true }));
    } finally {
      setBusy(false);
    }
  };

  const onStarted = (j: IngestionJob, d: KnowledgeDoc) => {
    setJobId(j.id);
    setDoc(d);
  };
  const cited = new Set(res?.citations ?? []);
  const order = res?.answer ? citationOrderFrom(res.answer, res.citations ?? []) : [];

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Knowledge Base" subtitle="Add official documents and test how the KAG retriever uses them."
        actions={<><Link to="/admin/sources" className="btn-secondary">Add website source</Link><button className="btn-primary" onClick={() => setUpload(true)}><Upload size={16} /> Upload document</button></>} />

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{job ? `Indexing: ${job.title}` : "Ingestion pipeline"}</h2>
          {job && <StatusPill status={job.status} />}
        </div>
        <PipelineViz status={job?.status} stages={job?.stages} />
        {job?.status === "COMPLETE" && doc && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-leaf-50 px-4 py-3 text-sm text-leaf-700">
            Knowledge is now searchable — {job.detail.chunks} chunks, embedding model <code>{job.detail.embedding_model}</code>, linked to {job.detail.schemes_linked?.join(", ") || "no scheme"}.
            <button className="btn-secondary btn-sm" onClick={() => setSel(doc.id)}>View chunks + metadata</button>
          </div>
        )}
        {job?.status === "FAILED" && <p className="mt-3 text-sm text-brick">{job.error}</p>}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-bold">KAG retrieval playground</h2>
        <p className="mb-3 text-sm text-ink-600">Ask a question to see query understanding, graph facts, ranked evidence and the grounded answer — e.g. to confirm a newly uploaded document now contributes evidence.</p>
        <form onSubmit={ask} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What should a farmer do after hailstorm damage?" />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : null} Run</button>
        </form>
        {res && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="eyebrow mb-1">Understanding</div>
              <pre className="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100">{JSON.stringify({ ...res.understanding, ...res.retrieval, mode: res.mode }, null, 2)}</pre>
              {res.answer && (
                <>
                  <div className="eyebrow mb-1 mt-4">Grounded answer</div>
                  <div className="rounded-lg bg-paper-100 p-3 text-sm"><Markdown text={res.answer} citationOrder={order} /></div>
                </>
              )}
            </div>
            <div>
              <div className="eyebrow mb-1">Ranked evidence ({res.retrieved.length})</div>
              <ol className="space-y-2">
                {res.retrieved.map((e) => (
                  <li key={e.id} className={`rounded-lg border p-2.5 text-sm ${cited.has(e.id) ? "border-saffron bg-saffron-50" : "border-paper-300 bg-white"}`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold">{e.id}</span>
                      <span className="chip bg-ink-100 text-ink-700">{e.type === "graph_fact" ? "graph" : e.retrieval?.join("+")}</span>
                      {e.score ? <span className="text-ink-500">score {e.score}</span> : null}
                      {e.vector_similarity != null && <span className="text-ink-500">sim {e.vector_similarity}</span>}
                      {cited.has(e.id) && <span className="chip bg-saffron text-white">cited</span>}
                    </div>
                    <div className="mt-1 font-semibold">{e.type === "graph_fact" ? e.scheme_name : e.source_title}{e.section ? ` · ${e.section}` : ""}</div>
                    <div className="line-clamp-2 text-ink-600">{e.text}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>
      <UploadModal open={upload} onClose={() => setUpload(false)} onStarted={onStarted} />
      <DocDrawer docId={sel} onClose={() => setSel(null)} onChanged={() => undefined} />
    </div>
  );
}
