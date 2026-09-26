import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/services/api";
import type { IngestionJob, KnowledgeDoc, SchemeCard } from "@/types";
import { ErrorNote, Modal, Spinner } from "@/components/ui";

export default function UploadModal({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: (job: IngestionJob, doc: KnowledgeDoc) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ title: "", publisher: "", source_name: "", source_url: "", published_date: "", is_demo: false });
  const [schemes, setSchemes] = useState<SchemeCard[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) api.get<{ schemes: SchemeCard[] }>("/api/admin/schemes").then((r) => setSchemes(r.schemes));
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setErr("Choose a file first.");
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      Object.entries(meta).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append("scheme_codes", codes.join(","));
      const r = await api.upload<{ job: IngestionJob; document: KnowledgeDoc }>("/api/admin/documents", fd);
      onStarted(r.job, r.document);
      setFile(null);
      setCodes([]);
      setMeta({ title: "", publisher: "", source_name: "", source_url: "", published_date: "", is_demo: false });
      onClose();
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload document" wide>
      <form onSubmit={submit} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ink-200 bg-paper-100 px-4 py-8 text-center hover:border-saffron">
          <input type="file" className="sr-only" accept=".pdf,.txt,.md,.markdown,.html,.htm,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="font-semibold text-ink-800">{file ? file.name : "Choose a file"}</span>
          <span className="mt-1 text-sm text-ink-500">Accepted: PDF / TXT / Markdown / HTML / DOCX · max 50 MB</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Title</label><input className="input" placeholder="Defaults to file name" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></div>
          <div><label className="label">Publisher</label><input className="input" placeholder="e.g. Department of Agriculture, Karnataka" value={meta.publisher} onChange={(e) => setMeta({ ...meta, publisher: e.target.value })} /></div>
          <div><label className="label">Source name</label><input className="input" placeholder="e.g. Raitha Mitra portal" value={meta.source_name} onChange={(e) => setMeta({ ...meta, source_name: e.target.value })} /></div>
          <div><label className="label">Official URL</label><input className="input" type="url" placeholder="https://…gov.in/…" value={meta.source_url} onChange={(e) => setMeta({ ...meta, source_url: e.target.value })} /></div>
          <div><label className="label">Published date</label><input className="input" type="date" value={meta.published_date} onChange={(e) => setMeta({ ...meta, published_date: e.target.value })} /></div>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink-700">
            <input type="checkbox" className="h-4 w-4" checked={meta.is_demo} onChange={(e) => setMeta({ ...meta, is_demo: e.target.checked })} /> Mark as demo / non-official document
          </label>
        </div>
        <div>
          <span className="label">Link to schemes in the graph (optional — also auto-detected)</span>
          <div className="flex flex-wrap gap-2">
            {schemes.map((s) => (
              <button type="button" key={s.code} onClick={() => setCodes((c) => (c.includes(s.code) ? c.filter((x) => x !== s.code) : [...c, s.code]))}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${codes.includes(s.code) ? "border-ink-800 bg-forest-800 text-white" : "border-ink-200 bg-white text-ink-700"}`}>
                {s.short_name || s.name}
              </button>
            ))}
          </div>
        </div>
        <ErrorNote>{err}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Upload &amp; index</button>
        </div>
      </form>
    </Modal>
  );
}
