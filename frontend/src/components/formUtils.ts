import type { FormDef, FormField, Lang } from "@/types";

export function resolveField(f: FormField, values: Record<string, any>): FormField {
  if (f.depends_on && f.variants) {
    const v = f.variants[values[f.depends_on]];
    if (v) return { ...f, label: v.label, labels: v.labels ?? f.labels };
  }
  return f;
}

export function fieldLabel(f: FormField, lang: Lang, values: Record<string, any>): string {
  const r = resolveField(f, values);
  return r.labels?.[lang] || r.label;
}

export function optionLabel(f: FormField, opt: string, lang: Lang): string {
  const i = f.options?.indexOf(opt) ?? -1;
  const ls = f.option_labels?.[lang];
  return i >= 0 && ls && ls[i] ? ls[i] : opt;
}

export function isFilled(f: FormField, v: any) {
  return f.type === "checkbox" ? v === true : v !== undefined && v !== null && v !== "";
}

export function allFields(form: FormDef) {
  return form.sections.flatMap((s) => s.fields.map((f) => ({ ...f, section: s })));
}

export function displayValue(f: FormField, v: any, lang: Lang, masked = false): string {
  if (v === undefined || v === null || v === "") return "—";
  if (f.type === "checkbox") return v ? "✓ Agreed" : "Not agreed";
  if (f.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = String(v).split("-");
    return `${d}/${m}/${y}`;
  }
  if (f.type === "select") return optionLabel(f, v, lang);
  if (f.type === "percent") return `${v}%`;
  if (f.type === "number") return `${v} acres`;
  if (masked && (f.type === "id_number" || f.type === "account")) {
    const d = String(v).replace(/\s/g, "");
    return "•".repeat(Math.max(0, d.length - 4)) + d.slice(-4);
  }
  return String(v);
}
