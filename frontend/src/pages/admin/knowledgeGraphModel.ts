import type { GraphView, KnowledgeDoc } from "@/types";

/*
 * Model of the whole knowledge base for the admin "Knowledge graph": the scheme graph (Neo4j) plus every indexed library
 * document, laid out as a hub ring in the middle with one cluster per node type at the corners of a hexagon.
 * Pure functions only, so the layout and the "what did this query use?" logic are testable without a browser.
 */

export type Kind = "hub" | "eligibility" | "requirement" | "access" | "library" | "publisher" | "source";

/** Colours follow the reference diagram; `angle` is the hexagon corner (degrees, SVG orientation: 0 = right, 90 = down). */
export const KINDS: Record<Kind, { title: string; color: string; angle: number | null }> = {
  hub: { title: "Scheme / life event", color: "#4c72b0", angle: null },
  eligibility: { title: "Eligibility rule", color: "#55a868", angle: 0 },
  requirement: { title: "Required document", color: "#8172b3", angle: 300 },
  access: { title: "Portal / department / state", color: "#ccb974", angle: 240 },
  library: { title: "Library document", color: "#64b5cd", angle: 180 },
  publisher: { title: "Source / publisher", color: "#c44e52", angle: 120 },
  source: { title: "Source document (graph)", color: "#a0a0a0", angle: 60 },
};
export const KIND_ORDER: Kind[] = ["hub", "eligibility", "requirement", "access", "library", "publisher", "source"];

const KIND_OF: Record<string, Kind> = {
  LifeEvent: "hub", Scheme: "hub", EligibilityRule: "eligibility", DocumentRequirement: "requirement",
  Portal: "access", Department: "access", State: "access", Source: "publisher", Document: "source",
};

export const W = 1200, H = 900, CX = W / 2, CY = H / 2;
const RING = 122, CORNER = 395;

export interface KgNode { id: string; kind: Kind; type: string; name: string; x: number; y: number; r: number; docId?: string; chunks?: number }
export interface KgEdge { from: string; to: string; type: string }
export interface SchemeLite { code: string; name: string; short_name?: string }
export interface KgModel {
  nodes: KgNode[]; edges: KgEdge[]; byId: Map<string, KgNode>; out: Map<string, KgEdge[]>;
  counts: Record<Kind, number>; schemeNode: Map<string, string>;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Dense staggered rows perpendicular to the corner's direction, like the clusters in the reference diagram. */
function arrange(nodes: KgNode[], angle: number) {
  const n = nodes.length;
  if (!n) return;
  const a = rad(angle);
  const u = { x: Math.cos(a), y: Math.sin(a) }; // outwards
  const t = { x: -Math.sin(a), y: Math.cos(a) }; // along the cluster
  const perRow = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 2.6))));
  const rows = Math.ceil(n / perRow);
  const gap = 15, rowGap = 14;
  const cx = CX + u.x * CORNER, cy = CY + u.y * CORNER;
  nodes.forEach((node, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const along = (col - (inRow - 1) / 2) * gap + (row % 2 ? gap / 2 : 0);
    const outward = (row - (rows - 1) / 2) * rowGap;
    node.x = cx + t.x * along + u.x * outward;
    node.y = cy + t.y * along + u.y * outward;
  });
}

export function buildModel(graph: GraphView, docs: KnowledgeDoc[], schemes: SchemeLite[]): KgModel {
  const nodes: KgNode[] = [];
  const byId = new Map<string, KgNode>();
  const add = (n: KgNode) => { nodes.push(n); byId.set(n.id, n); };

  for (const g of graph.nodes) {
    const kind = KIND_OF[g.label];
    if (!kind) continue;
    add({ id: g.id, kind, type: g.label, name: g.name, x: CX, y: CY, r: g.label === "Scheme" ? 17 : g.label === "LifeEvent" ? 12 : 7 });
  }
  for (const d of docs) add({ id: `lib:${d.id}`, kind: "library", type: "Library document", name: d.title, x: CX, y: CY, r: 5 + Math.min(4, Math.sqrt(d.chunk_count || 0) / 3), docId: d.id, chunks: d.chunk_count });

  // scheme code -> graph node. The Neo4j ids are opaque, so match on the display name (short name, else name); the in-memory graph uses "s:CODE".
  const schemeNode = new Map<string, string>();
  for (const s of schemes) {
    const want = s.short_name || s.name;
    const hit = byId.get(`s:${s.code}`) ?? nodes.find((n) => n.type === "Scheme" && n.name === want);
    if (hit) schemeNode.set(s.code, hit.id);
  }

  const edges: KgEdge[] = graph.edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => ({ from: e.from, to: e.to, type: e.type }));
  for (const d of docs) for (const code of d.scheme_codes ?? []) {
    const sid = schemeNode.get(code);
    if (sid) edges.push({ from: sid, to: `lib:${d.id}`, type: "DESCRIBED_IN" });
  }

  // hub ring in the middle
  const hubs = nodes.filter((n) => n.kind === "hub").sort((a, b) => (a.type === b.type ? 0 : a.type === "Scheme" ? -1 : 1));
  hubs.forEach((h, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, hubs.length)) * Math.PI * 2;
    h.x = CX + Math.cos(a) * RING * 1.35;
    h.y = CY + Math.sin(a) * RING;
  });
  for (const kind of KIND_ORDER) {
    const angle = KINDS[kind].angle;
    if (angle !== null) arrange(nodes.filter((n) => n.kind === kind), angle);
  }

  const out = new Map<string, KgEdge[]>();
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, nodes.filter((n) => n.kind === k).length])) as Record<Kind, number>;
  return { nodes, edges, byId, out, counts, schemeNode };
}

/** The parts of a KAG result the graph needs. */
export interface KagItem { id: string; type: "chunk" | "graph_fact"; text?: string; scheme_code?: string; scheme_codes?: string[]; relation?: string; document_id?: string }
export interface KagLike { retrieved?: KagItem[]; evidence?: KagItem[]; citations?: string[]; understanding?: { scheme_codes?: string[] } }

/**
 * Which nodes did this question actually use? A retrieved chunk lights its library document (and the schemes it is tagged
 * with); a graph fact lights its scheme plus the specific rule / required documents it quotes; cited items are marked
 * stronger. Everything else is "unused".
 */
export function relevance(m: KgModel, kag: KagLike): { lit: Set<string>; cited: Set<string> } {
  const lit = new Set<string>(), cited = new Set<string>();
  const items = [...(kag.retrieved ?? []), ...(kag.evidence ?? []).filter((e) => !(kag.retrieved ?? []).some((r) => r.id === e.id))];
  const cites = new Set(kag.citations ?? []);
  const mark = (id: string | undefined, isCited: boolean) => {
    if (!id || !m.byId.has(id)) return;
    lit.add(id);
    if (isCited) cited.add(id);
  };
  const scheme = (code?: string) => (code ? m.schemeNode.get(code) : undefined);
  const children = (sid: string, type: string) => (m.out.get(sid) ?? []).filter((e) => e.type === type).map((e) => e.to);

  for (const code of kag.understanding?.scheme_codes ?? []) mark(scheme(code), false);
  for (const it of items) {
    const c = cites.has(it.id);
    if (it.type === "chunk") {
      mark(it.document_id ? `lib:${it.document_id}` : undefined, c);
      for (const code of it.scheme_codes ?? []) mark(scheme(code), c);
      continue;
    }
    const sid = scheme(it.scheme_code);
    if (!sid) continue;
    mark(sid, c);
    const text = it.text ?? "", rel = it.relation ?? "";
    if (rel.includes("HAS_RULE")) for (const id of children(sid, "HAS_RULE")) if (text.includes(m.byId.get(id)!.name)) mark(id, c);
    if (rel.includes("REQUIRES")) for (const id of children(sid, "REQUIRES")) if (text.includes(m.byId.get(id)!.name)) mark(id, c);
    if (rel.includes("MANAGED_BY")) for (const id of children(sid, "MANAGED_BY")) mark(id, c);
    if (rel.includes("MATCHES")) for (const e of m.edges) if (e.type === "MATCHES" && e.to === sid) mark(e.from, c);
    if (rel.includes("APPLY_AT")) for (const id of children(sid, "APPLY_AT")) mark(id, c);
    if (rel.includes("AVAILABLE_IN")) for (const id of children(sid, "AVAILABLE_IN")) mark(id, c);
  }
  return { lit, cited };
}
