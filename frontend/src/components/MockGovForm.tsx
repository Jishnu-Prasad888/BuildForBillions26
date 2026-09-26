import { Save } from "lucide-react";
import { forwardRef, type Ref } from "react";
import type { FormDef, Lang } from "@/types";
import { fieldLabel, isFilled, optionLabel } from "./formUtils";

interface Props {
  form: FormDef;
  values: Record<string, any>;
  lang: Lang;
  highlightId?: string | null;
  flashIds?: string[];
  readOnly?: boolean;
  referenceLabel?: string;
  onChange: (id: string, value: any) => void;
  onFocusField?: (id: string) => void;
  onReview?: () => void;
  onSave?: () => void;
}

/* A realistic-looking but clearly DEMO government application form. Every field carries
   data-field-id / data-label / data-required so the assistant can read the visible form. */
const MockGovForm = forwardRef(function MockGovForm(
  { form, values, lang, highlightId, flashIds = [], readOnly, referenceLabel, onChange, onFocusField, onReview, onSave }: Props,
  ref: Ref<HTMLDivElement>,
) {
  const title = form.titles?.[lang] || form.title;
  return (
    <div ref={ref} className="demo-watermark overflow-hidden rounded-lg border-2 border-ink-300 bg-white shadow-card" data-screen-root>
      <div className="flex items-center gap-4 border-b-4 border-saffron bg-forest-800 px-6 py-4 text-white">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-white/70 text-[0.6rem] font-bold leading-tight">DEMO<br />SEAL</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-200">{form.authority}</div>
          <h2 className="font-display text-xl font-bold text-white">{title}</h2>
        </div>
        <div className="ml-auto hidden text-right text-xs text-ink-200 sm:block">
          <div>Form ID: {form.id.toUpperCase()}</div>
          <div>{referenceLabel ?? "Application no.: (assigned on submission)"}</div>
        </div>
      </div>
      {/* <div className="flex items-center gap-2 border-b border-saffron-100 bg-saffron-50 px-6 py-2 text-sm text-saffron-700" data-warning>
        <AlertCircle size={16} className="flex-none" /> <span>Fields marked <b className="text-brick">*</b> are mandatory. This is a DEMO form — nothing is sent to any government portal.</span>
      </div> */}

      <div className="space-y-8 px-6 py-6">
        {form.sections.map((sec, si) => (
          <fieldset key={sec.id} className="rounded-lg border border-ink-200">
            <legend className="ml-3 bg-white px-2 text-[0.95rem] font-bold text-ink-800">
              <span className="mr-2 text-saffron-600">{si + 1}.</span>
              {sec.titles?.[lang] || sec.title}
            </legend>
            <div className="grid gap-x-5 gap-y-4 px-4 pb-5 pt-2 md:grid-cols-2">
              {sec.fields.map((f) => {
                const label = fieldLabel(f, lang, values);
                const v = values[f.id];
                const active = highlightId === f.id;
                const flash = flashIds.includes(f.id);
                const wide = f.type === "textarea" || f.type === "checkbox";
                const common = {
                  id: `f-${f.id}`,
                  disabled: readOnly,
                  onFocus: () => onFocusField?.(f.id),
                  "aria-required": f.required,
                };
                return (
                  <div
                    key={f.id}
                    data-field-id={f.id}
                    data-label={label}
                    data-required={f.required ? "1" : "0"}
                    data-filled={isFilled(f, v) ? "1" : "0"}
                    className={`rounded-lg p-2 transition-all ${wide ? "md:col-span-2" : ""} ${active ? "bg-saffron-50 ring-2 ring-saffron" : ""} ${flash ? "animate-flash" : ""}`}
                  >
                    {f.type === "checkbox" ? (
                      <label className="flex items-start gap-3 text-[0.95rem] text-ink-800">
                        <input type="checkbox" {...common} className="mt-1 h-5 w-5 accent-ink-800" checked={v === true} onChange={(e) => onChange(f.id, e.target.checked)} />
                        <span>{label} <b className="text-brick">*</b><br /><span className="text-xs text-ink-500">Providing false information may lead to rejection and recovery of any amount paid.</span></span>
                      </label>
                    ) : (
                      <>
                        <label htmlFor={`f-${f.id}`} className="mb-1 block text-sm font-semibold text-ink-700">
                          {label} {f.required && <b className="text-brick">*</b>}
                        </label>
                        {f.type === "select" ? (
                          <select {...common} className="input" value={v ?? ""} onChange={(e) => onChange(f.id, e.target.value)}>
                            <option value="">— Select —</option>
                            {f.options!.map((o) => <option key={o} value={o}>{optionLabel(f, o, lang)}</option>)}
                          </select>
                        ) : f.type === "textarea" ? (
                          <textarea {...common} className="input min-h-[76px]" value={v ?? ""} onChange={(e) => onChange(f.id, e.target.value)} />
                        ) : (
                          <input
                            {...common}
                            className="input"
                            type={f.type === "date" ? "date" : f.type === "number" || f.type === "percent" ? "number" : "text"}
                            inputMode={["mobile", "account", "id_number"].includes(f.type) ? "numeric" : undefined}
                            step={f.type === "number" ? "0.01" : undefined}
                            min={f.type === "percent" || f.type === "number" ? 0 : undefined}
                            max={f.type === "percent" ? 100 : undefined}
                            disabled={readOnly || (f.depends_on ? !values[f.depends_on] : false)}
                            placeholder={f.depends_on && !values[f.depends_on] ? "Choose identity proof first" : f.type === "ifsc" ? "e.g. SBIN0001234" : ""}
                            value={v ?? ""}
                            onChange={(e) => onChange(f.id, f.type === "number" || f.type === "percent" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 bg-paper-100 px-6 py-4">
          <button type="button" className="btn-secondary" onClick={onSave}><Save size={16} /> Save draft</button>
          <button type="button" className="btn-primary" onClick={onReview}>Review &amp; submit</button>
        </div>
      )}
    </div>
  );
});

export default MockGovForm;
