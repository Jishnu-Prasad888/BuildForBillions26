import { ArrowRight, Check, X } from "lucide-react";

const STEPS = [
  { key: "UPLOADED", label: "Upload", sub: "PDF · HTML · TXT · MD · DOCX" },
  { key: "EXTRACTING", label: "Extract & clean", sub: "text, sections, pages" },
  { key: "CHUNKING", label: "Chunk", sub: "~900 chars, provenance kept" },
  { key: "EMBEDDING", label: "Embed", sub: "Ollama embedding model" },
  { key: "INDEXING", label: "Index", sub: "pgvector + full-text + Neo4j" },
  { key: "COMPLETE", label: "Searchable", sub: "available to KAG" },
];

/* With no status: static diagram. With a status: shows the live stage of an ingestion job. */
export default function PipelineViz({ status, stages }: { status?: string; stages?: { stage: string; detail?: string }[] }) {
  const reached = new Set(stages?.map((s) => s.stage) ?? []);
  const failed = status === "FAILED";
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const failedIdx = failed ? Math.max(0, ...STEPS.map((s, i) => (reached.has(s.key) ? i : 0))) : -1;
  return (
    <ol className="flex flex-wrap items-stretch gap-1.5">
      {STEPS.map((s, i) => {
        const done = status ? reached.has(s.key) && (i < currentIdx || status === "COMPLETE" || (failed && i < failedIdx)) : false;
        const active = status === s.key && status !== "COMPLETE";
        const detail = stages?.find((x) => x.stage === s.key)?.detail;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <div className={`w-[8.6rem] self-stretch rounded-lg border p-2.5 ${done ? "border-leaf-100 bg-leaf-50" : active ? "border-saffron bg-saffron-50" : i === failedIdx ? "border-brick-100 bg-brick-50" : "border-paper-300 bg-white"}`}>
              <div className="flex items-center gap-1.5 text-sm font-bold text-ink-800">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] text-white ${done ? "bg-leaf" : active ? "animate-pulse bg-saffron" : "bg-ink-300"}`}>{done ? <Check size={12} /> : i + 1}</span>
                {s.label}
              </div>
              <div className="mt-1 text-xs text-ink-500">{detail || s.sub}</div>
            </div>
            {i < STEPS.length - 1 && <ArrowRight size={14} className="text-ink-300" />}
          </li>
        );
      })}
      {failed && <li className="flex items-center gap-1 text-sm font-semibold text-brick"><X size={16} /> Failed</li>}
    </ol>
  );
}
