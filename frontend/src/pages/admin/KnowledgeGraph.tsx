import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import type { GraphView, KnowledgeDoc } from "@/types";
import { LoadError, Skeleton } from "@/components/apps/Skeleton";
import { CX, CY, H, KINDS, KIND_ORDER, W, buildModel, relevance, type KagLike, type KgModel, type KgNode, type SchemeLite } from "./knowledgeGraphModel";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* Google blue/grey palette: white nodes with grey strokes, blue hubs and highlights. */
const INK_300 = "#dadce0", INK_600 = "#5f6368", INK_900 = "#1f1f1f";
const BLUE = "#1a73e8", BLUE_DARK = "#0b57d0", BLUE_TONAL = "#d3e3fd";

/** Curve from a source to the rim of its target, bowed toward the middle like the reference diagram. */
function edgePath(a: KgNode, b: KgNode) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const cx = mx + (CX - mx) * 0.32, cy = my + (CY - my) * 0.32;
  const dx = b.x - cx, dy = b.y - cy, len = Math.hypot(dx, dy) || 1;
  return `M${a.x},${a.y} Q${cx},${cy} ${b.x - (dx / len) * (b.r + 2.5)},${b.y - (dy / len) * (b.r + 2.5)}`;
}

/**
 * The whole knowledge base as one graph: schemes in the middle, one cluster per node type around them.
 * With a KAG result, the nodes the question used stay sharp and glow; every unused node and link is blurred.
 */
export default function KnowledgeGraph({ kag, onOpenDoc }: { kag: KagLike | null; onOpenDoc: (documentId: string) => void }) {
  const [model, setModel] = useState<KgModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api.get<GraphView>("/api/admin/graph"),
      api.get<KnowledgeDoc[]>("/api/admin/documents"),
      api.get<{ schemes: SchemeLite[] }>("/api/admin/schemes"),
    ]).then(([g, d, s]) => setModel(buildModel(g, d, s.schemes))).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const active = kag !== null;
  const { lit, cited } = useMemo(() => (model && kag ? relevance(model, kag) : { lit: new Set<string>(), cited: new Set<string>() }), [model, kag]);
  const edges = useMemo(() => (model ? model.edges.map((e) => {
    const a = model.byId.get(e.from)!, b = model.byId.get(e.to)!;
    return { ...e, d: edgePath(a, b) };
  }) : []), [model]);
  const near = useMemo(() => {
    if (!model || !hover) return null;
    const s = new Set<string>([hover]);
    for (const e of model.edges) { if (e.from === hover) s.add(e.to); if (e.to === hover) s.add(e.from); }
    return s;
  }, [model, hover]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!model) return <Skeleton className="h-[420px] w-full" />;

  const nodeLit = (n: KgNode) => !active || lit.has(n.id);
  const edgeLit = (e: { from: string; to: string }) => !active || (lit.has(e.from) && lit.has(e.to));
  const drawEdge = (e: (typeof edges)[number], i: number, strong: boolean) => (
    <path key={i} d={e.d} fill="none" stroke={strong ? BLUE : INK_300} strokeWidth={strong ? 1.9 : 1.1} markerEnd={strong ? "url(#kg-arrow-lit)" : "url(#kg-arrow)"}
      opacity={near ? (e.from === hover || e.to === hover ? 1 : 0.08) : strong ? 0.9 : 0.42} />
  );
  const drawNode = (n: KgNode) => {
    const showLabel = n.kind === "hub" || (active && lit.has(n.id)) || hover === n.id;
    const right = n.x >= CX;
    const hubLabel = n.kind === "hub";
    const highlighted = active && lit.has(n.id);
    const fill = hubLabel ? BLUE : highlighted ? BLUE_TONAL : "#ffffff";
    const stroke = hubLabel ? BLUE_DARK : highlighted ? BLUE : INK_300;
    return (
      <g key={n.id} className={n.docId ? "cursor-pointer" : ""} style={{ opacity: near && !near.has(n.id) ? 0.15 : 1 }}
        onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={n.docId ? () => onOpenDoc(n.docId!) : undefined}>
        {cited.has(n.id) && <circle cx={n.x} cy={n.y} r={n.r + 6} fill={BLUE} opacity={0.22} />}
        <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke={stroke} strokeWidth={1.2} />
        {showLabel && (
          <text x={hubLabel ? n.x : n.x + (right ? n.r + 6 : -(n.r + 6))} y={hubLabel ? n.y + n.r + 14 : n.y + 3.5}
            textAnchor={hubLabel ? "middle" : right ? "start" : "end"} fontSize={hubLabel ? 12.5 : 10.5} fontWeight={500} fill={hubLabel ? INK_900 : INK_600}
            paintOrder="stroke" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round">{clip(n.name, hubLabel ? 26 : 34)}</text>
        )}
        <title>{`${n.type}: ${n.name}${n.chunks != null ? `\n${n.chunks} chunks · click to view` : ""}`}</title>
      </g>
    );
  };

  const litNodes = model.nodes.filter(nodeLit), dimNodes = model.nodes.filter((n) => !nodeLit(n));
  const litEdges = edges.filter(edgeLit), dimEdges = edges.filter((e) => !edgeLit(e));

  return (
    <div>
      <p className="mb-2 text-sm text-ink-600" aria-live="polite">
        {!active ? "The whole knowledge base. Ask a question to highlight what the retriever used; everything unused will be blurred."
          : lit.size === 0 ? "This question didn't reach any graph node or library document, so everything is blurred."
          : <><span className="font-medium text-ink-900">{lit.size}</span> of {model.nodes.length} nodes were used for this question; the rest are blurred.</>}
      </p>
      <div className="overflow-x-auto rounded-xl border border-paper-300 bg-paper-100">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[900px] animate-fadeIn" role="img" aria-label="Knowledge graph: schemes in the middle, one cluster per node type around them">
          <defs>
            <filter id="kg-blur" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><feGaussianBlur stdDeviation="2.6" /></filter>
            <filter id="kg-glow" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" result="b" />
              <feFlood floodColor={BLUE} floodOpacity="0.55" />
              <feComposite in2="b" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={INK_300} />
            </marker>
            <marker id="kg-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={BLUE} />
            </marker>
          </defs>
          {/* Unused: blurred and faded (only when a question has been asked). */}
          <g filter={active ? "url(#kg-blur)" : undefined} opacity={active ? 0.34 : 1}>
            {dimEdges.map((e, i) => drawEdge(e, i, false))}
            {dimNodes.map(drawNode)}
          </g>
          {/* Used: sharp, with a glow. */}
          <g>{litEdges.map((e, i) => drawEdge(e, 100000 + i, active))}</g>
          <g filter={active ? "url(#kg-glow)" : undefined}>{litNodes.map(drawNode)}</g>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
        {KIND_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border" style={{ background: k === "hub" ? BLUE : "#ffffff", borderColor: k === "hub" ? BLUE : INK_300 }} />{KINDS[k].title} <span className="text-ink-400">({model.counts[k]})</span></span>
        ))}
        <span className="text-ink-400">Hover to trace links · click a library document to see its chunks</span>
      </div>
    </div>
  );
}
