import { CheckCircle2, Circle, CircleDashed, HandMetal, Pencil, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormFieldDef, FormSchema, FormValueT } from "@/types";
import { Spinner } from "@/components/ui";

interface Props {
  schema: FormSchema;
  currentFieldId: string | null;
  flashIds: string[];
  onSelect: (id: string) => void;
  onSave: (values: Record<string, FormValueT | null>, extra?: { skip?: string[]; rename?: Record<string, string>; use_profile?: boolean }) => Promise<Record<string, string>>;
  onAsk: (field: FormFieldDef) => void;
}

const isoToDisplay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v);
const asText = (f: FormFieldDef, v: FormValueT | undefined): string => (v === undefined ? "" : typeof v === "boolean" ? String(v) : Array.isArray(v) ? v.join(", ") : f.type === "date" ? isoToDisplay(v) : v);

export default function AutoFillPanel({ schema, currentFieldId, flashIds, onSelect, onSave, onAsk }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const prevValues = useRef<Record<string, FormValueT>>(schema.values);
  useEffect(() => { // when the server changes a value (assistant, profile), drop the local draft for that field only
    const prev = prevValues.current;
    const changed = new Set([...Object.keys(schema.values), ...Object.keys(prev)].filter((k) => JSON.stringify(schema.values[k]) !== JSON.stringify(prev[k])));
    prevValues.current = schema.values;
    if (changed.size) setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !changed.has(k))));
  }, [schema.values]);
  useEffect(() => { if (currentFieldId) refs.current[currentFieldId]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [currentFieldId]);

  const groups = useMemo(() => {
    const m = new Map<number, FormFieldDef[]>();
    schema.fields.forEach((f) => m.set(f.page, [...(m.get(f.page) ?? []), f]));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [schema.fields]);

  const commit = async (f: FormFieldDef, value: FormValueT | null) => {
    setSaving(f.field_id);
    const errs = await onSave({ [f.field_id]: value });
    setErrors((e) => { const n = { ...e }; delete n[f.field_id]; return { ...n, ...errs }; });
    if (!errs[f.field_id]) setDrafts((d) => { const n = { ...d }; delete n[f.field_id]; return n; });
    setSaving(null);
  };

  const blurText = (f: FormFieldDef) => {
    const draft = drafts[f.field_id];
    if (draft === undefined || draft === asText(f, schema.values[f.field_id])) return;
    commit(f, draft.trim() === "" ? null : draft);
  };

  const useProfile = async () => {
    setProfileBusy(true);
    await onSave({}, { use_profile: true });
    setProfileBusy(false);
  };
  const canProfile = Object.keys(schema.profile_suggestions).length > 0;

  const input = (f: FormFieldDef) => {
    const v = schema.values[f.field_id];
    const id = `af-${f.field_id}`;
    if (f.manual) return <p className="flex items-center gap-1.5 text-sm text-ink-500"><HandMetal size={15} /> {f.type === "signature" ? "Sign this by hand on the completed form." : "For your safety, enter this yourself."}</p>;
    if (f.type === "checkbox") {
      return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v === true} onChange={(e) => commit(f, e.target.checked)} /> Tick this box</label>;
    }
    if (f.type === "choice") {
      if (f.meta.multiple) {
        const cur = Array.isArray(v) ? v : [];
        return <div className="space-y-1">{f.options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cur.includes(o)} onChange={(e) => commit(f, e.target.checked ? [...cur, o] : cur.filter((x) => x !== o).length ? cur.filter((x) => x !== o) : null)} /> {o}</label>
        ))}</div>;
      }
      if (f.options.length <= 4) {
        return <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>{f.options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={v === o} onClick={() => commit(f, v === o ? null : o)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${v === o ? "border-ink-800 bg-forest-800 text-white" : "border-ink-200 bg-white hover:bg-ink-50"}`}>{o}</button>
        ))}</div>;
      }
      return <select id={id} className="input py-2" value={typeof v === "string" ? v : ""} onChange={(e) => commit(f, e.target.value || null)}><option value="">Select…</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>;
    }
    const value = drafts[f.field_id] ?? asText(f, v);
    const common = { id, value, onFocus: () => onSelect(f.field_id), onBlur: () => blurText(f), autoComplete: "off", "aria-invalid": !!errors[f.field_id], "aria-describedby": errors[f.field_id] ? `${id}-err` : undefined };
    const set = (val: string) => setDrafts((d) => ({ ...d, [f.field_id]: val }));
    if (f.type === "multiline") return <textarea {...common} rows={3} className="input" onChange={(e) => set(e.target.value)} />;
    return (
      <input {...common} className="input" onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode={f.type === "phone" || f.type === "pincode" || f.type === "number" || f.type === "amount" || f.type === "bank_account" ? "numeric" : f.type === "email" ? "email" : undefined}
        type={f.type === "email" ? "email" : "text"}
        placeholder={f.type === "date" ? "DD/MM/YYYY" : f.type === "phone" ? "10-digit mobile number" : f.type === "ifsc" ? "e.g. SBIN0001234" : f.type === "identity_number" ? "As on the document" : ""} />
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-300 px-3 py-2">
        <div className="text-sm text-ink-600"><b className="text-ink-900">{schema.summary.completed}</b> of {schema.summary.fillable} done</div>
        <button className="btn-secondary btn-sm" disabled={!canProfile || profileBusy} onClick={useProfile} title="Fill empty fields I can match from your profile">
          {profileBusy ? <Spinner /> : <UserRound size={15} />} Use my profile
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.length === 0 && <p className="text-sm text-ink-600">I couldn't find any fields on this form. If it's a scan, try a clearer copy.</p>}
        {groups.map(([pageNo, fields]) => (
          <section key={pageNo}>
            {groups.length > 1 && <h3 className="eyebrow mb-2">Page {pageNo}</h3>}
            <div className="space-y-3">
              {fields.map((f) => {
                const st = schema.summary.status[f.field_id];
                const current = currentFieldId === f.field_id;
                return (
                  <div key={f.field_id} ref={(el) => (refs.current[f.field_id] = el)} data-field-id={f.field_id} onClick={() => onSelect(f.field_id)}
                    className={`rounded-lg border p-3 ${current ? "border-saffron bg-saffron-50/50" : "border-paper-300 bg-white"} ${flashIds.includes(f.field_id) ? "animate-flash" : ""}`}>
                    <div className="mb-1.5 flex items-start gap-2">
                      {st === "filled" ? <CheckCircle2 size={16} className="mt-0.5 flex-none text-leaf" /> : st === "skipped" ? <CircleDashed size={16} className="mt-0.5 flex-none text-saffron" /> : <Circle size={16} className="mt-0.5 flex-none text-ink-300" />}
                      <label htmlFor={`af-${f.field_id}`} className="flex-1 text-sm font-semibold text-ink-800">
                        {f.label}{f.required && st !== "manual" && <span className="text-brick" aria-label="required"> *</span>}
                        {schema.sources[f.field_id] === "assistant" && <span className="ml-1.5 chip bg-saffron-50 text-saffron-700">AI-filled</span>}
                        {schema.sources[f.field_id] === "profile" && <span className="ml-1.5 chip bg-ink-100 text-ink-600">from profile</span>}
                      </label>
                      <button className="btn-ghost btn-sm -my-1 px-1.5" onClick={(e) => { e.stopPropagation(); onAsk(f); }} aria-label={`Ask AI about ${f.label}`} title="Ask the AI about this field"><Sparkles size={15} /></button>
                    </div>
                    {f.description && <p className="mb-1.5 text-xs text-ink-500">{f.description}</p>}
                    {input(f)}
                    {errors[f.field_id] && <p id={`af-${f.field_id}-err`} role="alert" className="mt-1 text-sm text-brick">{errors[f.field_id]}</p>}
                    {saving === f.field_id && <p className="mt-1 text-xs text-ink-400">Saving…</p>}
                    {f.confidence < 0.6 && !f.manual && (
                      <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                        {renaming === f.field_id ? (
                          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const val = (new FormData(e.currentTarget).get("label") as string).trim(); if (val) { await onSave({}, { rename: { [f.field_id]: val } }); } setRenaming(null); }}>
                            <input name="label" defaultValue={f.label} className="input py-1 text-sm" aria-label="Field name" autoFocus />
                            <button className="btn-primary btn-sm">Save</button>
                          </form>
                        ) : (
                          <span>I couldn't confidently identify this field. You can manually specify what it is.{" "}
                            <button className="inline-flex items-center gap-1 font-semibold underline" onClick={(e) => { e.stopPropagation(); setRenaming(f.field_id); }}><Pencil size={12} /> Name it</button></span>
                        )}
                      </div>
                    )}
                    {(st === "missing") && !f.manual && f.type !== "checkbox" && (
                      <button className="mt-2 text-xs font-semibold text-ink-500 underline" onClick={(e) => { e.stopPropagation(); onSave({}, { skip: [f.field_id] }); }}>Fill this later</button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
