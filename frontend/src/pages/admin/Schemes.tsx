import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/services/api";
import type { GraphView as G, SchemeCard } from "@/types";
import GraphView from "@/components/GraphView";
import { ErrorNote, Modal, PageHeader, Spinner } from "@/components/ui";

type AdminScheme = SchemeCard & { life_events: string[]; states: { code: string; name: string }[]; source_docs: string[] };

export default function Schemes() {
  const [schemes, setSchemes] = useState<AdminScheme[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [graph, setGraph] = useState<G | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", summary: "", benefit: "", department: "KA_AGRI", portal: "", documents: "IDENTITY_PROOF,LAND_RECORD,BANK_DETAILS", rules: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get<{ schemes: AdminScheme[]; stats: any }>("/api/admin/schemes").then((r) => {
    setSchemes(r.schemes);
    setStats(r.stats);
    setSel((cur) => cur ?? r.schemes[0]?.code ?? null);
  });
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    api.get<G>(`/api/admin/graph${sel ? `?scheme=${sel}` : ""}`).then(setGraph);
  }, [sel, schemes.length]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.post("/api/admin/schemes", {
        code: form.code.toUpperCase(), name: form.name, summary: form.summary, benefit: form.benefit, department: form.department || null,
        portal: form.portal || null, states: ["KA"], life_events: ["CROP_DAMAGE"],
        documents: form.documents.split(",").map((s) => s.trim()).filter(Boolean),
        rules: form.rules.split("\n").map((t) => t.trim()).filter(Boolean).map((text) => ({ text })),
      });
      setOpen(false);
      load();
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  const s = schemes.find((x) => x.code === sel);

  return (
    <div>
      <PageHeader eyebrow="Neo4j knowledge graph" title="Schemes" subtitle={`Graph backend: ${stats.backend ?? "…"} · ${stats.schemes ?? 0} schemes · ${stats.rules ?? 0} eligibility rules · ${stats.document_requirements ?? 0} document requirements · ${stats.documents ?? 0} linked documents`}
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add scheme</button>} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <button onClick={() => setSel(null)} className={`card w-full p-3 text-left font-semibold ${!sel ? "ring-2 ring-saffron" : ""}`}>Whole graph</button>
          {schemes.map((x) => (
            <button key={x.code} onClick={() => setSel(x.code)} className={`card w-full p-3 text-left ${sel === x.code ? "ring-2 ring-saffron" : ""}`}>
              <div className="font-semibold">{x.short_name || x.name}</div>
              <div className="font-mono text-xs text-ink-500">{x.code}</div>
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {s && (
            <section className="card grid gap-4 p-5 sm:grid-cols-2">
              <div><div className="eyebrow">Scheme</div><div className="font-semibold">{s.name}</div></div>
              <div><div className="eyebrow">Life event</div><div>{s.life_events.join(", ")}</div></div>
              <div><div className="eyebrow">Department</div><div>{s.department}</div></div>
              <div><div className="eyebrow">Available in</div><div>{s.states.map((x) => x.name).join(", ")}</div></div>
              <div><div className="eyebrow">Required documents</div><ul className="text-sm">{s.documents.map((d) => <li key={d.code}>- {d.name}</li>)}</ul></div>
              <div><div className="eyebrow">Source documents</div><ul className="text-sm">{s.source_docs.map((d) => <li key={d} className="font-mono text-xs">{d}</li>)}</ul></div>
              <div className="sm:col-span-2"><div className="eyebrow">Eligibility rules</div><ul className="text-sm">{s.rules.map((r) => <li key={r.code}>- {r.text} <span className="text-xs text-ink-400">(supported by {r.supported_by || "—"})</span></li>)}</ul></div>
            </section>
          )}
          <section className="card p-5">{graph ? <GraphView graph={graph} /> : <Spinner />}</section>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add scheme to the graph" wide>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Code</label><input className="input font-mono" required pattern="[A-Za-z0-9_]{3,40}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="HORTI_RELIEF_KA" /></div>
          <div><label className="label">Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Summary</label><input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Benefit</label><input className="input" value={form.benefit} onChange={(e) => setForm({ ...form, benefit: e.target.value })} /></div>
          <div><label className="label">Department code</label><select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>{["KA_AGRI", "KA_REVENUE_DM", "MOAFW", "BANKS_DFS"].map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className="label">Portal code (optional)</label><input className="input" value={form.portal} onChange={(e) => setForm({ ...form, portal: e.target.value })} placeholder="KA_LANDRECORDS" /></div>
          <div className="sm:col-span-2"><label className="label">Required document codes (comma separated)</label><input className="input font-mono text-sm" value={form.documents} onChange={(e) => setForm({ ...form, documents: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Eligibility rules (one per line)</label><textarea className="input min-h-[90px]" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></div>
          <p className="text-xs text-ink-500 sm:col-span-2">New schemes are linked to the Crop Damage life event. Upload an official document and link it to the scheme so answers can cite it.</p>
          <div className="sm:col-span-2"><ErrorNote>{err}</ErrorNote></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
