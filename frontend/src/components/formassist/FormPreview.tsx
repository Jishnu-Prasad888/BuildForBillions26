import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { useAuthedBlobUrl } from "@/hooks/useAuthedBlob";
import type { FieldStatus, FormSchema } from "@/types";
import { Spinner } from "@/components/ui";

interface Props {
  formId: string;
  schema: FormSchema;
  page: number;
  onPage: (n: number) => void;
  source: "original" | "completed";
  version: string;
  currentFieldId: string | null;
  onSelectField: (id: string) => void;
  showFilled: boolean;
  flashIds: string[];
}

function overlayClass(status: FieldStatus | undefined, current: boolean, showFilled: boolean, flash: boolean): string {
  if (current) return "border-2 border-saffron bg-saffron/15 ring-2 ring-saffron/40";
  if (flash) return "animate-flash border-2 border-leaf";
  if (status === "filled" && showFilled) return "border border-leaf bg-leaf/15";
  if (status === "manual") return "border border-dashed border-ink-300";
  if (status === "missing" || status === "skipped") return "border border-dashed border-saffron/70 hover:bg-saffron/10";
  return "border border-transparent hover:border-ink-300";
}

export default function FormPreview({ formId, schema, page, onPage, source, version, currentFieldId, onSelectField, showFilled, flashIds }: Props) {
  const [zoom, setZoom] = useState(1);
  const pg = schema.pages.find((p) => p.page === page) ?? schema.pages[0];
  const { url, error, loading } = useAuthedBlobUrl(`/api/forms/${formId}/preview?page=${page}&source=${source}`, version);
  const fields = schema.fields.filter((f) => f.page === page);
  const total = schema.pages.length;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-paper-300 bg-ink-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-300 bg-white px-3 py-2 text-sm">
        <div className="flex items-center gap-1">
          <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
          <span className="min-w-[6.5rem] text-center font-semibold text-ink-800">Page {page} / {total}</span>
          <button className="btn-ghost btn-sm" disabled={page >= total} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
        </div>
        <span className="chip bg-ink-100 text-ink-700">{source === "completed" ? "Completed PDF" : "Your original form"}</span>
        <div className="flex items-center gap-1">
          <button className="btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} aria-label="Zoom out"><ZoomOut size={16} /></button>
          <span className="w-10 text-center text-xs text-ink-500">{Math.round(zoom * 100)}%</span>
          <button className="btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))} aria-label="Zoom in"><ZoomIn size={16} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {loading && !url && <div className="flex h-40 items-center justify-center"><Spinner className="h-6 w-6 text-ink-500" /></div>}
        {error && <p className="rounded-lg bg-brick-50 p-3 text-sm text-brick">{error}</p>}
        {url && pg && (
          <div className="relative mx-auto shadow-lift" style={{ width: `${zoom * 100}%`, maxWidth: `${zoom * 900}px` }}>
            <img src={url} alt={`Page ${page} of your form`} className="block w-full select-none bg-white" draggable={false} />
            {fields.map((f) => {
              const [x0, y0, x1, y1] = f.bbox;
              const boxes = f.type === "choice" || f.type === "checkbox" ? (f.meta.option_boxes as number[][] | undefined) : undefined;
              const st = schema.summary.status[f.field_id];
              const style = { left: `${(x0 / pg.width) * 100}%`, top: `${(y0 / pg.height) * 100}%`, width: `${((x1 - x0) / pg.width) * 100}%`, height: `${((y1 - y0) / pg.height) * 100}%` };
              return (
                <button key={f.field_id} type="button" title={f.label} aria-label={`Field: ${f.label}`} onClick={() => onSelectField(f.field_id)}
                  style={style} data-field-id={f.field_id}
                  className={`absolute rounded-sm transition-colors ${overlayClass(st, currentFieldId === f.field_id, showFilled, flashIds.includes(f.field_id))} ${boxes ? "pointer-events-none" : ""}`}>
                  {boxes && null}
                </button>
              );
            })}
            {/* choice groups: make each option box clickable to focus its field */}
            {fields.filter((f) => f.meta.option_boxes).flatMap((f) => (f.meta.option_boxes as number[][]).map((b, i) => (
              <button key={`${f.field_id}-${i}`} type="button" title={`${f.label}: ${f.options[i] ?? ""}`} onClick={() => onSelectField(f.field_id)}
                style={{ left: `${(b[0] / pg.width) * 100}%`, top: `${(b[1] / pg.height) * 100}%`, width: `${((b[2] - b[0]) / pg.width) * 100}%`, height: `${((b[3] - b[1]) / pg.height) * 100}%` }}
                className={`absolute rounded-sm ${currentFieldId === f.field_id ? "border-2 border-saffron" : "border border-transparent hover:border-saffron/70"}`} />
            )))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-paper-300 bg-white px-3 py-1.5 text-xs text-ink-500">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border-2 border-saffron bg-saffron/15" />selected</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-saffron/70" />needs information</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-leaf bg-leaf/15" />filled</span>
        {schema.pages.find((p) => p.page === page)?.warnings.includes("ocr_unclear") && <span className="text-brick">I couldn't read this page clearly.</span>}
      </div>
    </div>
  );
}
