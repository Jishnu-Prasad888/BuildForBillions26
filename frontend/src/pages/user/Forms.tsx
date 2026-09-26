import { Camera, FileImage, FileText, Loader2, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import type { UserForm } from "@/types";
import CameraCapture from "@/components/formassist/CameraCapture";
import { EmptyState, ErrorNote, Modal, PageHeader, Spinner, StatusPill, formatDate } from "@/components/ui";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_MB = 25;

export function formStatusLabel(f: UserForm): string {
  return f.status === "COMPLETED" ? "COMPLETE" : f.status === "READY" ? "IN_PROGRESS" : f.status === "ANALYZING" ? "EXTRACTING" : f.status;
}

export default function Forms() {
  const nav = useNavigate();
  const [forms, setForms] = useState<UserForm[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [drag, setDrag] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserForm | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api.get<UserForm[]>("/api/forms").then(setForms).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!forms?.some((f) => f.status === "ANALYZING")) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [forms, load]);

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is larger than ${MAX_MB} MB.`);
    setBusy("Uploading securely…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const created = await api.upload<UserForm>("/api/forms/upload", fd);
      setBusy("Reading the form…");
      await api.post(`/api/forms/${created.id}/analyze`, {});
      nav(`/forms/${created.id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
      load();
    }
  };

  const remove = async (f: UserForm) => {
    try {
      await api.del(`/api/forms/${f.id}`);
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="AI Form Assistant" title="Fill any form with help"
        subtitle="Upload a PDF or a photo of any form. I read it, explain each field, collect your details and prepare a completed PDF. Your original file is never changed." />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
        className={`card flex flex-col items-center gap-4 border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-saffron bg-saffron-50" : "border-paper-300"}`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-700"><UploadCloud size={28} /></div>
        {busy ? (
          <div className="flex items-center gap-2 font-semibold text-ink-800"><Spinner /> {busy}</div>
        ) : (
          <>
            <div>
              <div className="font-display text-xl font-bold">Drop a form here</div>
              <p className="mt-1 text-sm text-ink-600">PDF, JPG, PNG or WebP · up to {MAX_MB} MB · scanned, photographed or digital</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => fileRef.current?.click()}><UploadCloud size={17} /> Upload a form</button>
              <button className="btn-accent" onClick={() => setCamera(true)}><Camera size={17} /> Take Photo</button>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="flex items-center gap-1.5 text-xs text-ink-500"><ShieldCheck size={14} className="text-leaf" /> Private to your account. Only you can open your forms.</p>
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Your forms</h2>
      {forms === null ? <Spinner className="h-5 w-5" /> : forms.length === 0 ? (
        <EmptyState icon={<FileText size={28} />} title="No forms yet">Upload a form to get started.</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {forms.map((f) => (
            <li key={f.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="text-ink-400">{f.kind === "pdf" ? <FileText size={24} /> : <FileImage size={24} />}</div>
              <div className="min-w-0 flex-1">
                {f.status === "READY" || f.status === "COMPLETED" ? (
                  <Link to={`/forms/${f.id}`} className="block truncate font-semibold text-ink-900 hover:underline">{f.original_filename}</Link>
                ) : <div className="truncate font-semibold text-ink-900">{f.original_filename}</div>}
                <div className="text-xs text-ink-500">{f.page_count} page{f.page_count === 1 ? "" : "s"} · {(f.file_size / 1024).toFixed(0)} KB · {formatDate(f.created_at, true)}</div>
                {f.status === "FAILED" && <div className="mt-1 text-sm text-brick">{f.error}</div>}
              </div>
              {f.status === "ANALYZING" ? <span className="chip bg-saffron-50 text-saffron-700"><Loader2 size={12} className="animate-spin" /> Reading…</span> : <StatusPill status={formStatusLabel(f)} />}
              {f.output_ready && <span className="chip bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100">PDF ready</span>}
              {(f.status === "READY" || f.status === "COMPLETED") && <Link to={`/forms/${f.id}`} className="btn-secondary btn-sm">Open</Link>}
              {f.status === "FAILED" && <button className="btn-secondary btn-sm" onClick={async () => { await api.post(`/api/forms/${f.id}/analyze`, { force: true }); load(); }}>Try again</button>}
              <button className="btn-ghost btn-sm text-brick" onClick={() => setConfirmDelete(f)} aria-label={`Delete ${f.original_filename}`}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {camera && (
        <CameraCapture onClose={() => setCamera(false)} onUnavailable={() => { setCamera(false); captureRef.current?.click(); }}
          onCapture={(file) => { setCamera(false); upload(file); }} />
      )}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this form?">
        <p className="text-ink-700">“{confirmDelete?.original_filename}” and everything derived from it — page images, extracted text, your answers, notes and any completed PDF — will be permanently deleted.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-primary bg-brick hover:bg-brick" onClick={() => confirmDelete && remove(confirmDelete)}><Trash2 size={16} /> Delete permanently</button>
        </div>
      </Modal>
    </div>
  );
}
