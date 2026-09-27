import type { GraphView as G } from "@/types";

const COLORS: Record<string, string> = {
  LifeEvent: "#0842a0", Scheme: "#1a73e8", EligibilityRule: "#444746", DocumentRequirement: "#5f6368",
  Department: "#80868b", Portal: "#4285f4", State: "#9aa0a6", Document: "#7cacf8", Source: "#7cacf8",
};
const ORDER = ["EligibilityRule", "DocumentRequirement", "Department", "Portal", "State", "Document", "Source"];

/* Layered view of the Neo4j scheme graph: LifeEvent → Scheme → rules / documents / departments / portals. */
export default function GraphView({ graph, height }: { graph: G; height?: number }) {
  const cols: Record<number, G["nodes"]> = { 0: [], 1: [], 2: [] };
  for (const n of graph.nodes) {
    const c = n.label === "LifeEvent" ? 0 : n.label === "Scheme" ? 1 : 2;
    cols[c].push(n);
  }
  cols[2].sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
  const rowH = 30;
  const W = 900;
  const colX = [20, 220, 520];
  const colW = [170, 250, 360];
  const H = height ?? Math.max(...Object.values(cols).map((c) => c.length)) * rowH + 30;
  const pos: Record<string, { x: number; y: number; w: number }> = {};
  Object.entries(cols).forEach(([ci, nodes]) => {
    const c = Number(ci);
    const offset = (H - nodes.length * rowH) / 2;
    nodes.forEach((n, i) => (pos[n.id] = { x: colX[c], y: offset + i * rowH + 4, w: colW[c] }));
  });
  const trunc = (s: string, w: number) => (s.length * 6.4 > w - 26 ? s.slice(0, Math.floor((w - 26) / 6.4)) + "…" : s);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px]" role="img" aria-label="Knowledge graph">
        {graph.edges.map((e, i) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const [l, r] = a.x <= b.x ? [a, b] : [b, a];
          const x1 = l.x + l.w;
          const y1 = l.y + 11;
          const x2 = r.x;
          const y2 = r.y + 11;
          if (x2 <= x1) return null;
          const mx = (x1 + x2) / 2;
          return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#dadce0" strokeWidth="1.2"><title>{e.type}</title></path>;
        })}
        {graph.nodes.map((n) => {
          const p = pos[n.id];
          const col = COLORS[n.label] ?? "#5f6368";
          const hot = n.label === "Scheme" || n.label === "LifeEvent";
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <title>{`${n.label}: ${n.name}`}</title>
              <rect width={p.w} height={22} rx={6} fill="#fff" stroke={n.label === "Scheme" ? "#1a73e8" : "#dadce0"} strokeWidth={n.label === "Scheme" ? 1.5 : 1} />
              <rect width={6} height={22} rx={3} fill={col} />
              <text x={12} y={15} fontSize="11.5" fill={hot ? "#1f1f1f" : "#5f6368"} fontWeight={hot ? 500 : 400}>{trunc(n.name, p.w)}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-600">
        {Object.entries(COLORS).filter(([k]) => graph.nodes.some((n) => n.label === k)).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{k}</span>
        ))}
      </div>
    </div>
  );
}
