import { AlertTriangle, CheckCircle2, Download, Eye, HandMetal, Pencil, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import { downloadBlob } from "@/hooks/useAuthedBlob";
import type { FormReviewItem, UserForm } from "@/types";
import { ErrorNote, Spinner } from "@/components/ui";

interface ReviewData { items: FormReviewItem[]; missing: { field_id: string; label: string }[]; can_generate: boolean; block_letters: boolean }
interface Props {
  form: UserForm;
  refreshKey: string;
  onEdit: (fieldId: string) => void;
  onAsk: (fieldId: string, label: string) => void;
  onGenerated: (form: UserForm) => void;
  onPreviewPdf: () => void;
  onEditInfo: () => void;
}

export default function ReviewPanel({ form, refreshKey, onEdit, onAsk, onGenerated, onPreviewPdf, onEditInfo }: Props) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmBlank, setConfirmBlank] = useState(false);
  const [justMade, setJustMade] = useState(false);
  // null = follow the form: on when the form itself says "fill in BLOCK LETTERS".
  const [blockPick, setBlockPick] = useState<boolean | null>(null);

  const load = useCallback(() => api.get<ReviewData>(`/api/forms/${form.id}/review`).then(setData).catch((e) => setError(e.message)), [form.id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const generate = async (allowBlank: string[] = []) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ ok: boolean; warnings: string[]; form: UserForm }>(`/api/forms/${form.id}/generate`, { allow_blank: allowBlank, block_letters: blockPick ?? data?.block_letters ?? false });
      setWarnings(r.warnings);
      setJustMade(true);
      onGenerated(r.form);
      setConfirmBlank(false);
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="p-4">{error ? <ErrorNote>{error}</ErrorNote> : <Spinner className="h-5 w-5" />}</div>;
  const missing = data.missing;
  const blockOn = blockPick ?? data.block_letters;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-[9rem] flex-1 space-y-1 overflow-y-auto px-3 py-3">
        <h3 className="section-title mb-1">Review Information</h3>
        <p className="mb-3 text-sm text-ink-600">Check every answer before the PDF is made. Identity and bank numbers are shown masked.</p>
        {data.items.map((i) => (
          <div key={i.field_id} className="flex items-start gap-2.5 rounded-xl border border-paper-300 bg-white px-3 py-2">
            {i.status === "filled" ? <CheckCircle2 size={17} className="mt-0.5 flex-none text-leaf" />
              : i.status === "manual" ? <HandMetal size={17} className="mt-0.5 flex-none text-ink-400" />
              : i.status === "blank" ? <CheckCircle2 size={17} className="mt-0.5 flex-none text-ink-300" />
              : <AlertTriangle size={17} className={`mt-0.5 flex-none ${i.required ? "text-amber" : "text-ink-300"}`} />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink-800">{i.label}</div>
              <div className={`break-words text-sm ${i.status === "filled" ? "text-ink-900" : "text-ink-500"}`}>
                {i.status === "filled" ? i.display : i.status === "manual" ? "You complete this by hand" : i.status === "blank" ? "Left blank on purpose" : i.status === "skipped" ? "Waiting for information" : i.required ? "Missing" : "Optional — empty"}
              </div>
            </div>
            <div className="flex flex-none gap-1">
              {i.status !== "manual" && <button className="btn-ghost btn-sm px-1.5" onClick={() => onEdit(i.field_id)} aria-label={`Edit ${i.label}`}><Pencil size={14} /> <span className="hidden sm:inline">Edit</span></button>}
              {i.status !== "manual" && <button className="btn-ghost btn-sm px-1.5" onClick={() => onAsk(i.field_id, i.label)} aria-label={`Ask AI about ${i.label}`}><Sparkles size={14} /> <span className="hidden sm:inline">Ask AI</span></button>}
            </div>
          </div>
        ))}
      </div>
      <div className="max-h-[48%] flex-none space-y-2.5 overflow-y-auto border-t border-paper-300 bg-white px-3 py-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {justMade && form.output_ready && (
          <div className={`rounded-xl border p-3 ${warnings.length ? "border-amber-100 bg-amber-50" : "border-leaf-100 bg-leaf-50"}`}>
            <div className={`font-medium ${warnings.length ? "text-amber-700" : "text-leaf-700"}`}>
              {warnings.length ? `Your PDF was made, but ${warnings.length} ${warnings.length === 1 ? "value was" : "values were"} not written:` : "Your form is ready."}
            </div>
            {warnings.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-amber-700">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button className="btn-secondary btn-sm" onClick={onPreviewPdf}><Eye size={15} /> Preview PDF</button>
              <button className="btn-accent btn-sm" onClick={() => downloadBlob(`/api/forms/${form.id}/download`, `${form.original_filename.replace(/\.[^.]+$/, "")}-completed.pdf`).catch((e) => setError(e.message))}><Download size={15} /> Download Completed PDF</button>
              <button className="btn-ghost btn-sm" onClick={() => { setJustMade(false); onEditInfo(); }}><Pencil size={15} /> Edit Information</button>
            </div>
          </div>
        )}
        {missing.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
            <b>{missing.length} required field{missing.length === 1 ? " is" : "s are"} still empty:</b> {missing.slice(0, 5).map((m) => m.label).join(", ")}{missing.length > 5 ? ` and ${missing.length - 5} more` : ""}.
            <label className="mt-2 flex items-start gap-2 text-ink-800">
              <input type="checkbox" className="mt-1" checked={confirmBlank} onChange={(e) => setConfirmBlank(e.target.checked)} />
              <span>I choose to leave these blank on the PDF.</span>
            </label>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm text-ink-800">
          <input type="checkbox" className="mt-1" checked={blockOn} onChange={(e) => setBlockPick(e.target.checked)} />
          <span>Write in <b>BLOCK LETTERS</b>{data.block_letters && <span className="text-ink-500"> — this form asks for it</span>}</span>
        </label>
        <button className="btn-accent w-full py-2.5" disabled={busy || (missing.length > 0 && !confirmBlank)} onClick={() => generate(missing.length ? missing.map((m) => m.field_id) : [])}>
          {busy ? <Spinner /> : <Download size={17} />} {form.output_ready ? "Generate PDF again" : "Generate PDF"}
        </button>
        {form.output_ready && !justMade && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={onPreviewPdf}><Eye size={15} /> Preview PDF</button>
            <button className="btn-secondary btn-sm" onClick={() => downloadBlob(`/api/forms/${form.id}/download`, `${form.original_filename.replace(/\.[^.]+$/, "")}-completed.pdf`).catch((e) => setError(e.message))}><Download size={15} /> Download</button>
          </div>
        )}
      </div>
    </div>
  );
}
