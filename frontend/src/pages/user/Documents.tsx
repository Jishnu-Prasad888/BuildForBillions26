import { Car, Download, FileText, Fingerprint, Landmark, Map, Plus, ScrollText, Trash2, Upload, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, tokenStore } from "@/services/api";
import { useI18n } from "@/i18n";
import type { WalletDoc } from "@/types";
import { EmptyState, ErrorNote, Modal, PageHeader, Spinner, formatDate } from "@/components/ui";

const TYPES: Record<string, string> = {
  AADHAAR: "Aadhaar", DRIVING_LICENCE: "Driving licence", LAND_RECORD: "Land record (RTC / Pahani)",
  BANK: "Bank passbook / cheque", CERTIFICATE: "Certificate", OTHER: "Other",
};

const ICONS: Record<string, [LucideIcon, string]> = {
  AADHAAR: [Fingerprint, "bg-amber-50 text-amber-700"], DRIVING_LICENCE: [Car, "bg-ink-100 text-ink-700"], LAND_RECORD: [Map, "bg-leaf-50 text-leaf-700"],
  BANK: [Landmark, "bg-forest-50 text-forest-700"], CERTIFICATE: [ScrollText, "bg-saffron-50 text-saffron-700"],
};

export default function Documents() {
  const { t } = useI18n();
  const [docs, setDocs] = useState<WalletDoc[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doc_type: "LAND_RECORD", title: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    setLoadErr("");
    return api.get<WalletDoc[]>("/api/documents").then(setDocs).catch((e) => setLoadErr(e.message));
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("doc_type", form.doc_type);
      fd.append("title", form.title || TYPES[form.doc_type]);
      if (file) fd.append("file", file);
      await api.upload("/api/documents", fd);
      setOpen(false);
      setFile(null);
      setForm({ doc_type: "LAND_RECORD", title: "" });
      load();
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async (d: WalletDoc) => {
    const r = await fetch(`/api/documents/${d.id}/file`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = d.filename || "document";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader eyebrow="Document wallet" title={t("documents")} subtitle="Keep the documents you need for applications in one place. The assistant checks this wallet to tell you what's missing."
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Upload size={16} /> Add document</button>} />
      {loadErr && docs === null ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center" role="alert">
          <div className="font-medium text-ink-900">We couldn't load your documents</div>
          <p className="max-w-md text-sm text-ink-600">{loadErr}</p>
          <button className="btn-secondary btn-sm" onClick={load}>Try again</button>
        </div>
      ) : docs === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-40" />)}</div>
      ) : docs.length === 0 ? (
        <EmptyState icon={<FileText size={22} />} title="Your wallet is empty">
          Add your Aadhaar, land record and bank passbook so the assistant can check what's missing.
          <div><button className="btn-primary btn-sm mt-4" onClick={() => setOpen(true)}><Upload size={15} /> Add document</button></div>
        </EmptyState>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => {
            const [Icon, tone] = ICONS[d.doc_type] ?? [FileText, "bg-ink-100 text-ink-700"];
            return (
            <div key={d.id} className="card group flex flex-col p-4 transition-shadow hover:border-forest-200 hover:shadow-lift">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></div>
                <div className="min-w-0">
                  <div className="font-medium text-ink-900">{d.title}</div>
                  <div className="text-sm text-ink-600">{TYPES[d.doc_type] ?? d.doc_type}</div>
                </div>
              </div>
              {d.is_sample && <span className="chip mt-3 w-fit bg-amber-50 text-amber-700">Sample (demo data)</span>}
              {d.extracted_text && <p className="mt-3 line-clamp-3 rounded-lg bg-paper-100 px-2 py-1.5 font-mono text-xs text-ink-600">{d.extracted_text}</p>}
              <div className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-500">
                <span>{formatDate(d.created_at)}{d.size ? ` · ${(d.size / 1024).toFixed(0)} KB` : ""}</span>
                <span className="flex gap-1">
                  {d.has_file && <button className="btn-ghost btn-sm" onClick={() => download(d)} aria-label="Download"><Download size={15} /></button>}
                  <button className="btn-ghost btn-sm hover:text-brick" onClick={async () => { if (!window.confirm(`Delete "${d.title}" from your wallet?`)) return; await api.del(`/api/documents/${d.id}`); load(); }} aria-label={`Delete ${d.title}`}><Trash2 size={15} /></button>
                </span>
              </div>
            </div>
            );
          })}
          <button onClick={() => setOpen(true)}
            className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-paper-300 text-ink-500 transition-colors hover:border-forest-300 hover:bg-forest-50 hover:text-forest-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card"><Plus size={20} /></span>
            <span className="font-medium">Add document</span>
          </button>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a document">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Document type</label>
            <select className="input" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder={TYPES[form.doc_type]} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">File (PDF, JPG, PNG or TXT — optional)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="mt-1 text-xs text-ink-500">Text is extracted from PDFs and TXT files. Do not upload real identity documents to this demo.</p>
          </div>
          <ErrorNote>{err}</ErrorNote>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
