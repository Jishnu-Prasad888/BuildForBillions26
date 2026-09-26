import { Database, ExternalLink, FolderSync, Layers, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { EmptyState, ErrorNote, ProgressBar, SkeletonList, Spinner, StatusPill, formatDate } from "@/components/ui";

interface LibraryDoc {
  slug: string; title: string; category: string; publisher: string; source_url?: string | null; size: number;
  document_id?: string | null; status: string; chunk_count: number; language?: string | null;
}
interface SyncStatus {
  running: boolean; total: number; done: number; current?: string | null; indexed: number; unchanged: number;
  skipped: number; failed: number; removed: number; started_at?: string | null; finished_at?: string | null; error?: string | null;
}
export interface Library {
  folder: { path: string; exists: boolean; documents: number; indexed: number; chunks: number };
  sync: SyncStatus;
  vector_store: { backend: string; collection?: string; location?: string; vectors: number | null; status: string };
  embedding_model: string;
  documents: LibraryDoc[];
}

const CATEGORY: Record<string, string> = { scheme: "Scheme", dept: "Department", portal: "Portal", pdf: "PDF", index: "Index" };

/** The scraped scheme folder as indexed in Chroma: sync it, watch progress, and open any document's chunks. */
export default function SchemeLibrary({ onOpen }: { onOpen: (documentId: string) => void }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => api.get<Library>("/api/admin/knowledge").then(setLib).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  // Poll while a sync runs so the counts and statuses fill in live.
  useEffect(() => {
    if (!lib?.sync.running) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [lib?.sync.running, load]);

  const sync = async (force = false) => {
    setErr("");
    setStarting(true);
    try {
      await api.post(`/api/admin/knowledge/sync${force ? "?force=true" : ""}`, {});
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setStarting(false);
    }
  };

  const docs = lib?.documents ?? [];
  const cats = useMemo(() => ["all", ...Array.from(new Set(docs.map((d) => d.category))).sort()], [docs]);
  const shown = docs.filter((d) => (cat === "all" || d.category === cat) && (!q || `${d.title} ${d.publisher} ${d.slug}`.toLowerCase().includes(q.toLowerCase())));
  const s = lib?.sync;
  const vs = lib?.vector_store;

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><FolderSync size={19} className="text-forest-600" /> Scheme library</h2>
          <p className="text-sm text-ink-600">Pages and PDFs from the <code className="rounded bg-ink-100 px-1">scheme/</code> folder, chunked, embedded and stored in ChromaDB. The assistant retrieves from this index.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" disabled={starting || s?.running} onClick={() => sync(true)} title="Re-embed every document, even unchanged ones">
            <RefreshCw size={15} /> Rebuild all
          </button>
          <button className="btn-primary btn-sm" disabled={starting || s?.running} onClick={() => sync(false)}>
            {starting || s?.running ? <Spinner /> : <FolderSync size={15} />} {s?.running ? "Syncing…" : "Sync folder"}
          </button>
        </div>
      </div>
      <ErrorNote>{err}</ErrorNote>

      {!lib ? <SkeletonList rows={3} className="h-14" /> : !lib.folder.exists ? (
        <EmptyState icon={<FolderSync size={22} />} title="Scheme folder not found">Expected at <code>{lib.folder.path}</code>. Set <code>SCHEME_DIR</code> in the backend environment.</EmptyState>
      ) : (
        <>
          <div className="stagger grid gap-3 sm:grid-cols-3">
            <Tile icon={Layers} label="Documents indexed" value={`${lib.folder.indexed} / ${lib.folder.documents}`} />
            <Tile icon={Database} label={`Vectors in ${vs?.backend === "chroma" ? `Chroma · ${vs.collection}` : vs?.backend}`}
              value={vs?.vectors == null ? vs?.status ?? "–" : vs.vectors.toLocaleString()} warn={vs?.status === "unavailable"} />
            <Tile icon={Search} label="Embedding model" value={lib.embedding_model} small />
          </div>

          <div className="mt-4 rounded-lg bg-paper-100 px-4 py-3 text-sm">
            {s?.running ? (
              <>
                <div className="mb-2 flex flex-wrap justify-between gap-2 font-semibold text-ink-800">
                  <span>Indexing {s.done} of {s.total}{s.current ? ` · ${s.current}` : ""}</span>
                  <span className="text-ink-500">{s.indexed} new/changed · {s.unchanged} unchanged · {s.failed} failed</span>
                </div>
                <ProgressBar value={s.total ? Math.round((s.done / s.total) * 100) : 0} />
              </>
            ) : s?.finished_at ? (
              <span className="text-ink-700">
                Last sync {formatDate(s.finished_at, true)}: {s.indexed} indexed, {s.unchanged} unchanged, {s.skipped} skipped (too little text), {s.failed} failed{s.removed ? `, ${s.removed} removed` : ""}.
                {s.error && <span className="text-brick"> {s.error}</span>}
              </span>
            ) : (
              <span className="text-ink-600">No sync has run in this server process yet. The folder syncs automatically at startup; statuses below come from the index.</span>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input py-2 pl-9 text-sm" placeholder="Search the library" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {cats.map((c) => (
                <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${cat === c ? "border-forest-800 bg-forest-800 text-white" : "border-paper-300 bg-white text-ink-700 hover:bg-forest-50"}`}>
                  {c === "all" ? "All" : CATEGORY[c] ?? c} <span className="opacity-70">{c === "all" ? docs.length : docs.filter((d) => d.category === c).length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-lg border border-paper-300">
            {shown.length === 0 ? <p className="p-4 text-sm text-ink-500">No documents match.</p> : (
              <ul className="divide-y divide-paper-300">
                {shown.map((d) => (
                  <li key={d.slug}>
                    <button className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-forest-50 disabled:cursor-default disabled:hover:bg-transparent"
                      disabled={!d.document_id} onClick={() => d.document_id && onOpen(d.document_id)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{d.title}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-ink-500">
                          {d.publisher} · {(d.size / 1024).toFixed(0)} KB{d.chunk_count ? ` · ${d.chunk_count} chunks` : ""}{d.language ? ` · ${d.language}` : ""}
                          {d.source_url && (
                            <a href={d.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-ink-400 hover:text-forest-700" aria-label="Open source"><ExternalLink size={12} /></a>
                          )}
                        </span>
                      </span>
                      <span className="chip hidden bg-ink-100 text-ink-600 sm:inline-flex">{CATEGORY[d.category] ?? d.category}</span>
                      <StatusPill status={d.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Tile({ icon: Icon, label, value, small, warn }: { icon: typeof Database; label: string; value: string; small?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-paper-300 bg-white p-3">
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${warn ? "bg-brick-50 text-brick" : "bg-forest-50 text-forest-700"}`}><Icon size={18} /></span>
      <span className="min-w-0">
        <span className={`block truncate font-bold text-ink-900 ${small ? "text-sm" : "font-display text-lg"}`}>{value}</span>
        <span className="block truncate text-xs text-ink-500">{label}</span>
      </span>
    </div>
  );
}
