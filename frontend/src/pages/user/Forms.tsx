import { Camera, FileImage, FileText, Loader2, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import type { Application, UserForm } from "@/types";
import CameraCapture from "@/components/formassist/CameraCapture";
import { ApplicationCard, WorkCard } from "@/components/apps/WorkCard";
import FormCatalog from "@/components/apps/FormCatalog";
import { CardGridSkeleton, LoadError } from "@/components/apps/Skeleton";
import { bucketOf } from "@/components/apps/status";
import { EmptyState, ErrorNote, Modal, PageHeader, Spinner, StatusPill, formatDate } from "@/components/ui";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_MB = 25;

export function formStatusLabel(f: UserForm): string {
  return f.status === "COMPLETED" ? "COMPLETE" : f.status === "READY" ? "IN_PROGRESS" : f.status === "ANALYZING" ? "EXTRACTING" : f.status;
}

type Filter = "all" | "open" | "done";
type Item = { key: string; at: string; open: boolean; node: ReactNode };

export default function Forms() {
  const nav = useNavigate();
  const [forms, setForms] = useState<UserForm[] | null>(null);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [drag, setDrag] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmDelete, setConfirmDelete] = useState<UserForm | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoadError(null);
    return Promise.all([
      api.get<UserForm[]>("/api/forms").then(setForms),
      api.get<Application[]>("/api/applications").then(setApps),
    ]).catch((e) => setLoadError(e.message));
  }, []);
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

  const uploadCard = (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-5 text-center transition-all duration-200 ${drag ? "scale-[1.01] border-forest-500 bg-forest-50 shadow-lift" : "border-ink-200 bg-white hover:border-forest-200"}`}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-forest-50 text-forest-700 ${busy ? "" : "animate-float"}`}><UploadCloud size={24} /></div>
      <div>
        <h3 className="font-display text-[1.05rem] font-bold leading-snug text-ink-900">Your own form</h3>
        <p className="mx-auto mt-0.5 max-w-xs text-sm text-ink-600">Drop a PDF or a photo of any form here. I read it, explain each field and prepare a completed PDF.</p>
        <p className="mt-1.5 text-xs text-ink-500">PDF, JPG, PNG or WebP · up to {MAX_MB} MB</p>
      </div>
      {busy ? (
        <div className="flex items-center gap-2 font-semibold text-ink-800" role="status"><Spinner /> {busy}</div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary btn-sm" onClick={() => fileRef.current?.click()}><UploadCloud size={15} /> Upload a form</button>
          <button className="btn-secondary btn-sm" onClick={() => setCamera(true)}><Camera size={15} /> Take photo</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="flex items-center gap-1.5 text-xs text-ink-500"><ShieldCheck size={14} className="flex-none text-leaf" /> Private to your account. Your original file is never changed.</p>
    </div>
  );

  // Applications and uploads share one list, newest first.
  const items = useMemo<Item[]>(() => {
    const fromApps: Item[] = (apps ?? []).map((a) => ({
      key: `a-${a.id}`, at: a.updated_at, open: bucketOf(a.status) === "active", node: <ApplicationCard app={a} />,
    }));
    const fromForms: Item[] = (forms ?? []).map((f) => {
      const ready = f.status === "READY" || f.status === "COMPLETED";
      return {
        key: `f-${f.id}`, at: f.updated_at, open: f.status !== "COMPLETED",
        node: (
          <WorkCard
            icon={f.kind === "pdf" ? <FileText size={20} /> : <FileImage size={20} />}
            tag="Uploaded form"
            title={f.original_filename}
            titleTo={ready ? `/forms/${f.id}` : undefined}
            meta={`${f.page_count} page${f.page_count === 1 ? "" : "s"} · ${(f.file_size / 1024).toFixed(0)} KB · ${formatDate(f.created_at, true)}`}
            status={f.status === "ANALYZING"
              ? <span className="chip bg-amber-50 text-amber-700"><Loader2 size={12} className="animate-spin" /> Reading…</span>
              : <StatusPill status={formStatusLabel(f)} />}
            hint={f.status === "FAILED" ? <span className="text-brick">{f.error}</span> : f.output_ready ? "Your completed PDF is ready to download." : f.status === "READY" ? "Read and ready. Open it to fill with the assistant." : undefined}
            primary={ready ? { label: f.status === "COMPLETED" ? "View form" : "Continue with assistant", to: `/forms/${f.id}`, icon: f.status === "COMPLETED" ? undefined : <Sparkles size={15} /> } : undefined}
            actions={
              <>
                {f.status === "FAILED" && <button className="btn-secondary btn-sm" onClick={async () => { await api.post(`/api/forms/${f.id}/analyze`, { force: true }); load(); }}>Try again</button>}
                <button className="btn-ghost btn-sm ml-auto text-brick" onClick={() => setConfirmDelete(f)} aria-label={`Delete ${f.original_filename}`}><Trash2 size={16} /></button>
              </>
            }
          />
        ),
      };
    });
    return [...fromApps, ...fromForms].sort((x, y) => y.at.localeCompare(x.at));
  }, [apps, forms, load]);

  const shown = items.filter((i) => filter === "all" || (filter === "open" ? i.open : !i.open));
  const chips: [Filter, string, number][] = [
    ["all", "All", items.length],
    ["open", "In progress", items.filter((i) => i.open).length],
    ["done", "Done", items.filter((i) => !i.open).length],
  ];

  return (
    <div>
      <PageHeader eyebrow="AI Form Assistant" title="Fill a form with help"
        subtitle="Pick a government form or upload your own. The assistant explains every field, takes your answers by voice or typing, and gets it ready to submit." />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <h2 className="mb-3 font-display text-xl font-bold">Start a form</h2>
      <FormCatalog apps={apps} leading={uploadCard} />

      <div className="mb-3 mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Your forms</h2>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter your forms">
            {chips.map(([id, label, n]) => (
              <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
                className={`chip px-3 py-1 text-sm ${filter === id ? "bg-forest-800 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"}`}>
                {label} <span className={filter === id ? "text-forest-200" : "text-ink-400"}>{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {loadError ? <LoadError message={loadError} onRetry={load} /> : forms === null || apps === null ? <CardGridSkeleton count={2} /> : items.length === 0 ? (
        <EmptyState icon={<FileText size={28} />} title="Nothing here yet">Pick a government form above, or upload your own, and it will show up here.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="No forms match this filter" />
      ) : (
        <div key={filter} className="stagger grid gap-4 md:grid-cols-2">{shown.map((i) => <Fragment key={i.key}>{i.node}</Fragment>)}</div>
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
