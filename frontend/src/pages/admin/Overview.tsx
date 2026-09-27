import { Bot, Cpu, FileText, Globe, Layers, Network, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import type { AIHealth, IngestionJob } from "@/types";
import { EmptyState, PageHeader, Spinner, StatusPill, formatDate } from "@/components/ui";
import PipelineViz from "./PipelineViz";

interface OverviewData {
  documents: number;
  sources: number;
  chunks: number;
  users: number;
  applications: number;
  graph: Record<string, any>;
  last_indexed: string | null;
  recent_ingestion: IngestionJob[];
  ai: AIHealth;
  embeddings_by_model: { model: string; chunks: number }[];
  vector_backend: string;
}

function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-leaf" : warn ? "bg-amber" : "bg-brick"}`} />;
}

export default function Overview() {
  const [d, setD] = useState<OverviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get<OverviewData>("/api/admin/overview").then(setD);
  useEffect(() => {
    load();
  }, []);
  if (!d) {
    return (
      <div aria-busy aria-label="Loading">
        <div className="mb-7 space-y-2.5">
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton h-8 w-72 max-w-full" />
          <div className="skeleton h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }
  const stats = [
    { icon: FileText, label: "Documents", value: d.documents, to: "/admin/documents" },
    { icon: Globe, label: "Sources", value: d.sources, to: "/admin/sources" },
    { icon: Layers, label: "Chunks", value: d.chunks.toLocaleString("en-IN"), to: "/admin/knowledge" },
    { icon: Network, label: "Schemes", value: d.graph.schemes, to: "/admin/schemes" },
    { icon: Users, label: "Users", value: d.users, to: "/admin/users" },
  ];
  const ai = d.ai;
  const stale = d.embeddings_by_model.length > 1 || (ai.embedding_status === "connected" && d.embeddings_by_model.some((m) => m.model === "hash-fallback"));
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Knowledge base overview" subtitle={`Last indexed: ${formatDate(d.last_indexed, true)} · Vector store: PostgreSQL ${d.vector_backend} · Graph: ${d.graph.backend}`} />
      <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ icon: Icon, label, value, to }) => (
          <Link key={label} to={to} className="card p-4 transition-shadow hover:shadow-lift">
            <Icon size={18} className="text-ink-500" />
            <div className="mt-2 text-2xl font-medium text-ink-900">{value}</div>
            <div className="text-sm text-ink-600">{label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">AI system</h2>
            <span className={`chip ${ai.status === "connected" ? "bg-leaf-50 text-leaf-700" : "bg-amber-50 text-amber-700"}`}>{ai.status}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-paper-300 p-3">
              <div className="eyebrow flex items-center gap-1.5"><Bot size={13} /> LLM</div>
              <div className="mt-1 font-medium capitalize text-ink-900">{ai.llm_provider}</div>
              <div className="break-all font-mono text-sm text-ink-600">{ai.llm_model}</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm"><Dot ok={ai.llm_status === "connected"} warn={ai.fallback_active.llm} /> {ai.llm_status === "connected" ? "Connected" : ai.fallback_active.llm ? "Offline · deterministic fallback" : "Unavailable"}</div>
            </div>
            <div className="rounded-xl border border-paper-300 p-3">
              <div className="eyebrow flex items-center gap-1.5"><Cpu size={13} /> Embeddings</div>
              <div className="mt-1 font-medium capitalize text-ink-900">{ai.embedding_provider}</div>
              <div className="break-all font-mono text-sm text-ink-600">{ai.embedding_model} · {ai.embedding_dim}d</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm"><Dot ok={ai.embedding_status === "connected"} warn={ai.fallback_active.embeddings} /> {ai.embedding_status === "connected" ? "Connected" : ai.fallback_active.embeddings ? "Offline · lexical fallback" : "Unavailable"}</div>
            </div>
            <div className="rounded-xl border border-paper-300 p-3 sm:col-span-2">
              <div className="eyebrow">Vision (screen understanding)</div>
              <div className="mt-1 text-sm">{ai.vision_model ? <><span className="font-mono">{ai.vision_model}</span> · {ai.vision_status}</> : "Not configured — the form assistant reads the form structure; set VISION_MODEL to also analyse screen frames."}</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-ink-600">
            <div className="eyebrow mb-1">Chunks by embedding model</div>
            {d.embeddings_by_model.map((m) => <div key={m.model} className="flex justify-between font-mono text-xs"><span>{m.model}</span><span>{m.chunks}</span></div>)}
            {stale && (
              <button className="btn-secondary btn-sm mt-3" disabled={busy} onClick={async () => { setBusy(true); await api.post("/api/admin/reembed"); await load(); setBusy(false); }}>
                {busy ? <Spinner /> : <RefreshCw size={14} />} Re-embed all chunks with current model
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-500">Switch providers (Ollama / OpenAI / Kimi) by editing <code>backend/.env</code> — no code changes. API keys are never shown here.</p>
        </section>

        <section className="card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Recent ingestion</h2>
            <Link to="/admin/ingestion" className="link text-sm">All jobs →</Link>
          </div>
          {d.recent_ingestion.length === 0 ? (
            <EmptyState icon={<FileText size={22} />} title="No ingestion jobs yet">
              Uploaded documents and fetched web pages will appear here as they move through the pipeline.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-paper-300">
              {d.recent_ingestion.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-900">{j.title}</div>
                    <div className="text-xs text-ink-500">{j.kind} · {formatDate(j.created_at, true)}{j.detail?.chunks ? ` · ${j.detail.chunks} chunks` : ""}</div>
                  </div>
                  <StatusPill status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="section-title mb-1">Admin upload → KAG pipeline</h2>
        <p className="mb-4 text-sm text-ink-600">What happens to every document before it can be used as evidence.</p>
        <PipelineViz />
      </section>
    </div>
  );
}
