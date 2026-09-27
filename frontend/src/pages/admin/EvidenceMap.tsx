import { useMemo, useState } from "react";
import type { Evidence } from "@/types";

type Ev = Evidence & { relevant?: boolean; scheme_codes?: string[] };
interface Hub { id: string; kind: "scheme" | "group"; name: string; docs: string[] }
interface Doc { id: string; title: string; publisher: string; chunks: number; best: number; cited: boolean; methods: Set<string>; hubs: string[] }

const W = 1200, H = 600, CX = W / 2, CY = H / 2; // extra width keeps outer-ring labels inside the canvas
const R1 = 150, R2 = 262, STRETCH = 1.45; // ellipse: the canvas is wider than tall
const at = (r: number, a: number) => ({ x: CX + Math.cos(a) * r * STRETCH, y: CY + Math.sin(a) * r });
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const pretty = (code: string) => code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Map of one KAG retrieval: the question in the middle, schemes found (graph facts or scheme-tagged
 * chunks) on the inner ring, and every retrieved document on the outer ring next to the scheme it
 * describes. Documents not tied to a graph scheme are grouped by publisher. Cited documents glow.
 */
export default function EvidenceMap({ question, items, cited, onOpenDoc }: { question: string; items: Ev[]; cited: Set<string>; onOpenDoc: (documentId: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);

  const { hubs, docs } = useMemo(() => {
    const names: Record<string, string> = {};
    for (const e of items) if (e.type === "graph_fact" && e.scheme_code) names[e.scheme_code] = e.scheme_name || pretty(e.scheme_code);
    const docs = new Map<string, Doc>();
    for (const e of items) {
      if (e.type !== "chunk" || !e.document_id) continue;
      const d = docs.get(e.document_id) ?? { id: e.document_id, title: e.source_title || "Document", publisher: e.publisher || e.source_name || "Other sources",
        chunks: 0, best: 0, cited: false, methods: new Set<string>(), hubs: [] };
      d.chunks += 1;
      d.best = Math.max(d.best, e.score ?? 0);
      d.cited ||= cited.has(e.id);
      (e.retrieval ?? []).forEach((m) => d.methods.add(m));
      for (const c of e.scheme_codes ?? []) {
        if (!names[c]) names[c] = pretty(c);
        if (!d.hubs.includes("s:" + c)) d.hubs.push("s:" + c);
      }
      docs.set(d.id, d);
    }
    const hubs = new Map<string, Hub>();
    for (const [code, name] of Object.entries(names)) hubs.set("s:" + code, { id: "s:" + code, kind: "scheme", name, docs: [] });
    for (const d of docs.values()) {
      if (!d.hubs.length) {
        const gid = "g:" + d.publisher;
        if (!hubs.has(gid)) hubs.set(gid, { id: gid, kind: "group", name: d.publisher, docs: [] });
        d.hubs.push(gid);
      }
      hubs.get(d.hubs[0])!.docs.push(d.id); // placed beside its first hub; extra links drawn as edges
    }
    return { hubs: [...hubs.values()], docs };
  }, [items, cited]);

  if (!hubs.length) return <p className="rounded-xl bg-paper-100 p-4 text-sm text-ink-500">No schemes or documents were retrieved for this question.</p>;

  // Each hub owns an angular sector proportional to its document count (min one slot), so fans never overlap.
  const slots = hubs.map((h) => Math.max(1, h.docs.length));
  const total = slots.reduce((a, b) => a + b, 0);
  const pos: Record<string, { x: number; y: number; a: number }> = {};
  let cursor = -Math.PI / 2 - (Math.PI * 2 * slots[0]) / total / 2;
  hubs.forEach((h, i) => {
    const span = (Math.PI * 2 * slots[i]) / total;
    const mid = cursor + span / 2;
    pos[h.id] = { ...at(R1, mid), a: mid };
    h.docs.forEach((d, j) => {
      const a = cursor + (span * (j + 0.5)) / h.docs.length;
      pos[d] = { ...at(R2, a), a };
    });
    cursor += span;
  });

  const lit = (id: string) => !hover || hover === id || (docs.get(hover)?.hubs.includes(id) ?? false) || (docs.get(id)?.hubs.includes(hover) ?? false);
  const bestMax = Math.max(0.0001, ...[...docs.values()].map((d) => d.best));
  let n = 0; // animation order

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-paper-300 bg-[radial-gradient(circle_at_center,#f1f3f4_0%,#ffffff_70%)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[820px]" role="img" aria-label="Retrieval map: schemes and the documents behind them">
          {/* guide rings */}
          <ellipse cx={CX} cy={CY} rx={R1 * STRETCH} ry={R1} fill="none" stroke="#e8eaed" strokeDasharray="4 6" />
          <ellipse cx={CX} cy={CY} rx={R2 * STRETCH} ry={R2} fill="none" stroke="#e8eaed" strokeDasharray="4 6" />

          {/* question → hub */}
          {hubs.map((h) => (
            <line key={"q" + h.id} x1={CX} y1={CY} x2={pos[h.id].x} y2={pos[h.id].y} pathLength={1}
              className="kag-edge" style={{ animationDelay: "150ms", opacity: lit(h.id) ? 1 : 0.15 }}
              stroke={h.kind === "scheme" ? "#7cacf8" : "#dadce0"} strokeWidth={h.kind === "scheme" ? 2 : 1.4} />
          ))}
          {/* hub → document (extra scheme links drawn lighter) */}
          {[...docs.values()].flatMap((d) => d.hubs.map((hid, k) => {
            const a = pos[hid], b = pos[d.id];
            const c = at(R1 + (R2 - R1) * 0.55, (a.a + b.a) / 2);
            return (
              <path key={d.id + hid} d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`} fill="none" pathLength={1}
                className="kag-edge" style={{ animationDelay: "450ms", opacity: lit(d.id) && lit(hid) ? 1 : 0.12 }}
                stroke={d.cited ? "#1a73e8" : k > 0 ? "#e8eaed" : "#dadce0"} strokeWidth={d.cited ? 2 : 1.3} />
            );
          }))}

          {/* the question */}
          <g className="kag-pop" style={{ animationDelay: "0ms" }}>
            <circle cx={CX} cy={CY} r={40} fill="#0b57d0" />
            <circle cx={CX} cy={CY} r={48} fill="none" stroke="#7cacf8" strokeWidth={1.5} className="kag-pulse" />
            <text x={CX} y={CY - 3} textAnchor="middle" fontSize="11" fontWeight={500} fill="#d3e3fd">YOUR</text>
            <text x={CX} y={CY + 11} textAnchor="middle" fontSize="11" fontWeight={500} fill="#d3e3fd">QUESTION</text>
            <title>{question}</title>
          </g>

          {hubs.map((h) => {
            const p = pos[h.id];
            const below = p.y >= CY;
            const scheme = h.kind === "scheme";
            return (
              <g key={h.id} className="kag-pop cursor-default" style={{ animationDelay: `${120 + n++ * 70}ms`, opacity: lit(h.id) ? 1 : 0.3 }}
                onMouseEnter={() => setHover(h.id)} onMouseLeave={() => setHover(null)}>
                <circle cx={p.x} cy={p.y} r={scheme ? 24 : 18} fill={scheme ? "#1a73e8" : "#fff"} stroke={scheme ? "#0b57d0" : "#9aa0a6"} strokeWidth={scheme ? 2 : 1.5} strokeDasharray={scheme ? undefined : "3 3"} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight={500} fill={scheme ? "#fff" : "#5f6368"}>{h.docs.length}</text>
                <text x={p.x} y={p.y + (below ? 40 : -32)} textAnchor="middle" fontSize="12.5" fontWeight={500} fill={scheme ? "#1f1f1f" : "#5f6368"}
                  paintOrder="stroke" stroke="#fff" strokeWidth={4} strokeLinejoin="round">{clip(h.name, 30)}</text>
                <title>{`${scheme ? "Scheme (knowledge graph)" : "Publisher group"}: ${h.name}\n${h.docs.length} retrieved document${h.docs.length === 1 ? "" : "s"}`}</title>
              </g>
            );
          })}

          {[...docs.values()].map((d) => {
            const p = pos[d.id];
            const right = Math.cos(p.a) >= 0;
            const r = 8 + 7 * (d.best / bestMax);
            return (
              <g key={d.id} className="kag-pop cursor-pointer" style={{ animationDelay: `${520 + n++ * 60}ms`, opacity: lit(d.id) ? 1 : 0.3 }}
                onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpenDoc(d.id)}>
                {d.cited && <circle cx={p.x} cy={p.y} r={r + 6} fill="#d3e3fd" />}
                <circle cx={p.x} cy={p.y} r={r} fill={d.cited ? "#1a73e8" : "#fff"} stroke={d.cited ? "#0b57d0" : "#9aa0a6"} strokeWidth={1.5} />
                <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight={500} fill={d.cited ? "#fff" : "#444746"}>{d.chunks}</text>
                <text x={p.x + (right ? r + 8 : -(r + 8))} y={p.y - 2} textAnchor={right ? "start" : "end"} fontSize="11.5" fontWeight={500} fill="#1f1f1f"
                  paintOrder="stroke" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round">{clip(d.title, 34)}</text>
                <text x={p.x + (right ? r + 8 : -(r + 8))} y={p.y + 12} textAnchor={right ? "start" : "end"} fontSize="10" fill="#5f6368"
                  paintOrder="stroke" stroke="#fff" strokeWidth={3} strokeLinejoin="round">{clip(d.publisher, 30)}{d.cited ? " · cited" : ""}</text>
                <title>{`${d.title}\n${d.publisher}\n${d.chunks} chunk${d.chunks === 1 ? "" : "s"} · best score ${d.best.toFixed(3)} · ${[...d.methods].join(" + ")}\nClick to view chunks`}</title>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-forest-800" /> Question</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-forest-600" /> Scheme (graph)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-ink-400 bg-white" /> Publisher group</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-ink-400 bg-white" /> Document (number = chunks, size = score)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-forest-600 ring-2 ring-forest-100" /> Cited in the answer</span>
        <span className="text-ink-400">Hover to trace links · click a document to see its chunks</span>
      </div>
    </div>
  );
}
