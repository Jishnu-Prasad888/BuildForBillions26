import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-hidden />;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-display text-[1.9rem] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-ink-100 text-ink-700" },
  IN_PROGRESS: { label: "In progress", cls: "bg-saffron-50 text-saffron-700 ring-1 ring-saffron-100" },
  DOCUMENTS_REQUIRED: { label: "Documents required", cls: "bg-brick-50 text-brick ring-1 ring-brick-100" },
  SUBMITTED: { label: "Submitted (demo)", cls: "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100" },
  UNDER_REVIEW: { label: "Under review", cls: "bg-ink-100 text-ink-800" },
  FIELD_VERIFICATION: { label: "Field verification", cls: "bg-ink-100 text-ink-800" },
  APPROVED: { label: "Approved (demo)", cls: "bg-leaf text-white" },
  COMPLETE: { label: "Complete", cls: "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100" },
  PENDING: { label: "Pending", cls: "bg-ink-100 text-ink-600" },
  SKIPPED: { label: "Later", cls: "bg-saffron-50 text-saffron-700" },
  FAILED: { label: "Failed", cls: "bg-brick-50 text-brick" },
  UPLOADED: { label: "Uploaded", cls: "bg-ink-100 text-ink-700" },
  EXTRACTING: { label: "Extracting", cls: "bg-saffron-50 text-saffron-700" },
  CHUNKING: { label: "Chunking", cls: "bg-saffron-50 text-saffron-700" },
  EMBEDDING: { label: "Embedding", cls: "bg-saffron-50 text-saffron-700" },
  INDEXING: { label: "Indexing", cls: "bg-saffron-50 text-saffron-700" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-ink-100 text-ink-700" };
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-ink-100 ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${value >= 100 ? "bg-leaf" : "bg-saffron"}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-paper-300 bg-paper-100 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <div className="font-semibold text-ink-800">{title}</div>
      {children && <div className="mt-1 text-sm text-ink-600">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={`card max-h-[90vh] w-full overflow-auto p-6 shadow-lift ${wide ? "max-w-3xl" : "max-w-lg"}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button className="btn-ghost btn-sm -mr-2 -mt-1" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/30" onMouseDown={onClose}>
      <aside className={`flex h-full w-full ${width} flex-col bg-paper-100 shadow-lift`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-paper-300 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-paper-300" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
            value === t.id ? "border-saffron text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return <span className={`chip bg-saffron-50 text-saffron-700 ring-1 ring-saffron-100 ${className}`}>DEMO</span>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-lg border border-brick-100 bg-brick-50 px-3.5 py-2.5 text-sm text-brick">{children}</div>;
}

export function formatDate(iso?: string | null, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
