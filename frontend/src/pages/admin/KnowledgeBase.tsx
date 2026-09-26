import { ChevronRight, Search, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import type { Evidence, IngestionJob, KnowledgeDoc } from "@/types";
import Markdown, { citationOrderFrom } from "@/components/Markdown";
import { PageHeader, Spinner, Tabs } from "@/components/ui";
import UploadModal from "./UploadModal";
import DocDrawer from "./DocDrawer";
import SchemeLibrary from "./SchemeLibrary";
import EvidenceMap from "./EvidenceMap";
import KnowledgeGraph from "./KnowledgeGraph";

interface KagResult {
  answer?: string;
  citations?: string[];
  evidence?: Evidence[];
  retrieved: (Evidence & { relevant?: boolean })[];
  understanding: Record<string, any>;
  retrieval: Record<string, any>;
  mode?: string;
}

type View = "graph" | "map";

/** The ranked list is long, so it folds away; it starts closed and re-closes for every new question (the parent keys it). */
function RankedEvidence({ items, cited }: { items: KagResult["retrieved"]; cited: Set<string> }) {
  const [open, setOpen] = useState(false);
  const citedCount = items.filter((e) => cited.has(e.id)).length;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md py-1 text-left hover:bg-paper-100">
        <ChevronRight size={16} className={`flex-none text-ink-500 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="eyebrow">Ranked evidence ({items.length})</span>
        <span className="ml-auto pr-1 text-xs text-ink-400">{citedCount ? `${citedCount} cited · ` : ""}{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {items.map((e) => (
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
      )}
    </div>
  );
}

export default function KnowledgeBase() {
  const [upload, setUpload] = useState(false);
  const [started, setStarted] = useState<string | null>(null); // title of the document whose indexing just began
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<View>("graph");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<KagResult | null>(null);
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      setRes(await api.post<KagResult>("/api/kag/query", { question: q, generate: true }));
      setAsked(q);
    } finally {
      setBusy(false);
    }
  };

  // Progress lives on the Ingestion page; here we only say that indexing began.
  const onStarted = (_job: IngestionJob, d: KnowledgeDoc) => setStarted(d.title);
  const cited = new Set(res?.citations ?? []);
  const order = res?.answer ? citationOrderFrom(res.answer, res.citations ?? []) : [];

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Knowledge Base" subtitle="A playground to test how the KAG retriever uses the knowledge graph and the scheme library, plus the scheme library itself."
        actions={<><Link to="/admin/sources" className="btn-secondary">Add website source</Link><button className="btn-primary" onClick={() => setUpload(true)}><Upload size={16} /> Upload document</button></>} />

      {started && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-leaf-50 px-4 py-3 text-sm text-leaf-700" role="status">
          <span>Indexing started for <b>{started}</b>. It becomes searchable when the pipeline finishes.</span>
          <Link to="/admin/ingestion" className="link">View progress</Link>
          <button className="btn-ghost btn-sm ml-auto" onClick={() => setStarted(null)}>Dismiss</button>
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-bold">KAG retrieval playground</h2>
        <p className="mb-3 text-sm text-ink-600">Ask a question to see query understanding, graph facts, ranked evidence and the grounded answer — e.g. to confirm a newly uploaded document now contributes evidence.</p>
        <form onSubmit={ask} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What should a farmer do after hailstorm damage?" />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : null} Run</button>
        </form>

        <div className="mt-5">
          <Tabs<View> value={view} onChange={setView} tabs={[{ id: "graph", label: "Knowledge graph" }, { id: "map", label: "Retrieval map" }]} />
          <div className="mt-4">
            {view === "graph" ? (
              <KnowledgeGraph kag={res} onOpenDoc={setSel} />
            ) : res ? (
              <div key={asked} className="animate-fadeIn">
                {/* Retrieved chunks plus cited anchors (which may not be in the ranked list), de-duplicated. */}
                <EvidenceMap question={asked} cited={cited} onOpenDoc={setSel}
                  items={[...res.retrieved, ...(res.evidence ?? []).filter((e) => !res.retrieved.some((r) => r.id === e.id))]} />
              </div>
            ) : (
              <p className="rounded-lg bg-paper-100 p-4 text-sm text-ink-500">Run a question to see its retrieval map: the schemes and documents behind the answer.</p>
            )}
          </div>
        </div>

        {res && (
          <div key={asked} className="mt-6 grid animate-fadeIn gap-5 lg:grid-cols-[1fr_1fr]">
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
            <RankedEvidence items={res.retrieved} cited={cited} />
          </div>
        )}
      </section>

      <div className="mt-6"><SchemeLibrary onOpen={setSel} /></div>

      <UploadModal open={upload} onClose={() => setUpload(false)} onStarted={onStarted} />
      <DocDrawer docId={sel} onClose={() => setSel(null)} onChanged={() => undefined} />
    </div>
  );
}
