import { BookOpenCheck, ChevronDown, ExternalLink, FileText, Network, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Evidence } from "@/types";
import { Drawer } from "./ui";
import { useI18n } from "@/i18n";

export function SourcesButton({ evidence, onOpen }: { evidence: Evidence[]; onOpen: () => void }) {
  const { t } = useI18n();
  if (!evidence.length) return null;
  const docs = evidence.filter((e) => e.type === "chunk").length;
  const facts = evidence.length - docs;
  return (
    <button onClick={onOpen} className="mt-2 inline-flex min-h-[36px] items-center gap-2 rounded-full border border-ink-300 bg-transparent px-3.5 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-400 hover:bg-forest-50">
      <BookOpenCheck size={16} className="text-saffron-600" />
      {t("sources_used")}: {evidence.length}
      <span className="font-normal text-ink-500">
        ({docs} document{docs === 1 ? "" : "s"}
        {facts ? `, ${facts} graph fact${facts === 1 ? "" : "s"}` : ""})
      </span>
    </button>
  );
}

function EvidenceItem({ e, n, highlight }: { e: Evidence; n: number; highlight: boolean }) {
  const [open, setOpen] = useState(highlight);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);
  const isFact = e.type === "graph_fact";
  return (
    <div ref={ref} className={`card overflow-hidden ${highlight ? "ring-2 ring-saffron" : ""}`}>
      <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-saffron-50 text-sm font-medium text-saffron-700 ring-1 ring-saffron-100">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-900">{e.publisher || e.source_name || "Source"}</div>
          <div className="text-[0.95rem] text-ink-700">{isFact ? e.scheme_name : e.source_title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
            {isFact ? (
              <span className="chip bg-ink-100 text-ink-700"><Network size={12} /> Knowledge graph</span>
            ) : (
              <span className="chip bg-ink-100 text-ink-700"><FileText size={12} /> Document chunk</span>
            )}
            {e.section && <span>Section: <span className="font-medium text-ink-700">{e.section}</span></span>}
            {e.page && <span>· Page {e.page}</span>}
            {e.is_demo && <span className="chip bg-amber-50 text-amber-700">Demo seed summary</span>}
          </div>
        </div>
        <ChevronDown size={18} className={`mt-1 flex-none text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-paper-300 bg-paper-100 px-4 py-3 text-sm">
          <div className="eyebrow mb-1.5">{isFact ? "Graph fact" : "Evidence chunk"}</div>
          <blockquote className="whitespace-pre-line rounded-lg border-l-4 border-saffron bg-white px-3 py-2 text-ink-800">“{e.text}”</blockquote>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-600">
            <dt className="font-medium text-ink-700">ID</dt><dd className="font-mono">{e.id}</dd>
            {isFact && e.relation && (<><dt className="font-medium text-ink-700">Path</dt><dd className="font-mono">{e.relation}</dd></>)}
            {isFact && e.supporting_document && (<><dt className="font-medium text-ink-700">Supported by</dt><dd>{e.supporting_document}</dd></>)}
            {!isFact && (<><dt className="font-medium text-ink-700">Document</dt><dd>{e.source_title}</dd></>)}
            {e.published_date && (<><dt className="font-medium text-ink-700">Published</dt><dd>{e.published_date}</dd></>)}
            {e.retrieved_at && (<><dt className="font-medium text-ink-700">Retrieved</dt><dd>{new Date(e.retrieved_at).toLocaleDateString("en-IN")}</dd></>)}
            {e.retrieval && e.retrieval.length > 0 && (<><dt className="font-medium text-ink-700">Found by</dt><dd>{e.retrieval.join(" + ")}{e.vector_similarity != null ? ` · similarity ${e.vector_similarity.toFixed(2)}` : ""}</dd></>)}
            {e.content_hash && (<><dt className="font-medium text-ink-700">Hash</dt><dd className="font-mono">{e.content_hash.slice(0, 16)}…</dd></>)}
            {e.url && (
              <>
                <dt className="font-medium text-ink-700">URL</dt>
                <dd>
                  <a href={e.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 break-all">
                    {e.url} <ExternalLink size={12} className="flex-none" />
                  </a>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

export function EvidenceDrawer({ open, onClose, evidence, focusId }: { open: boolean; onClose: () => void; evidence: Evidence[]; focusId?: string | null }) {
  return (
    <Drawer open={open} onClose={onClose} title="Evidence">
      <div className="mb-4 flex gap-3 rounded-xl border border-leaf-100 bg-leaf-50 p-3 text-sm text-leaf-700">
        <ShieldCheck size={20} className="flex-none" />
        <p>These are the exact sources and evidence chunks the assistant was given and cited to produce this answer. The AI explains; the sources are the authority.</p>
      </div>
      <div className="space-y-3">
        {evidence.map((e, i) => (
          <EvidenceItem key={e.id} e={e} n={i + 1} highlight={focusId === e.id} />
        ))}
      </div>
    </Drawer>
  );
}

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return (
    <div className="space-y-3">
      {evidence.map((e, i) => (
        <EvidenceItem key={e.id} e={e} n={i + 1} highlight={false} />
      ))}
    </div>
  );
}
