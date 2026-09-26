import { Check, Copy, Download, Share2, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/services/api";
import type { FormFieldDef, FormFieldType, FormValueT } from "@/types";

function maskVal(val: string, _type: FormFieldType): string {
  // Mask long digit sequences for account numbers, Aadhaar, phone, etc.
  if (typeof val !== "string") return String(val);
  // Specific Aadhaar pattern: #### #### ####
  const masked = val.replace(/\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, "XXXX XXXX XXXX");
  // Any other run of 8+ digits: keep last 4
  return masked.replace(/\b\d{8,}\b/g, (m) => "X".repeat(m.length - 4) + m.slice(-4));
}

function fieldSensitive(type: FormFieldType): boolean {
  return ["number", "amount", "account", "phone", "text", "name"].includes(type);
}

function buildTextSummary(fields: FormFieldDef[], values: Record<string, FormValueT>): string {
  const lines: string[] = ["Filled form summary", "=".repeat(40)];
  for (const f of fields) {
    if (f.type === "signature") continue;
    const raw = values[f.field_id];
    if (raw == null || raw === "" || raw === false) continue;
    const display = Array.isArray(raw) ? raw.join(", ") : String(raw);
    const safe = fieldSensitive(f.type) ? maskVal(display, f.type) : display;
    lines.push(`${f.label}: ${safe}`);
  }
  return lines.join("\n");
}

async function getPdfBlob(formId: string): Promise<Blob> {
  return api.blob(`/api/forms/${formId}/download`);
}

interface Props {
  open: boolean;
  onClose: () => void;
  formId: string;
  formName: string;
  outputReady: boolean;
  fields: FormFieldDef[];
  values: Record<string, FormValueT>;
  getTranscript?: () => string;
}

export default function ShareSheet({ open, onClose, formId, formName, outputReady, fields, values, getTranscript }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const baseName = formName.replace(/\.[^.]+$/, "") + "-completed.pdf";

  const handleSharePdf = async () => {
    if (!outputReady) { showToast("Generate the PDF first — go to Review."); return; }
    setBusy(true);
    try {
      const blob = await getPdfBlob(formId);
      const file = new File([blob], baseName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: baseName });
        showToast("Shared!");
      } else {
        // Fallback: download
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = baseName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        showToast("Downloaded!");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") showToast("Could not share: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!outputReady) { showToast("Generate the PDF first — go to Review."); return; }
    setBusy(true);
    try {
      const blob = await getPdfBlob(formId);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = baseName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToast("Downloaded!");
    } catch (e: any) {
      showToast("Could not download: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopySummary = async () => {
    const text = buildTextSummary(fields, values);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Summary copied — account numbers and Aadhaar are masked.");
    } catch {
      showToast("Could not copy to clipboard.");
    }
  };

  const handleCopyTranscript = async () => {
    const text = getTranscript?.() ?? "";
    if (!text.trim()) { showToast("No conversation yet."); return; }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Transcript copied!");
    } catch {
      showToast("Could not copy to clipboard.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Share your form">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-lg bg-white p-5 shadow-xl sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink-800">Share</h2>
          <button onClick={onClose} className="rounded-full p-1 text-ink-500 hover:bg-paper-100"><X size={20} /></button>
        </div>

        <div className="space-y-2.5">
          <button
            className="flex w-full items-center gap-3 rounded-lg border border-paper-300 bg-white px-4 py-3 text-left font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            onClick={handleSharePdf} disabled={busy || !outputReady}
          >
            <Share2 size={18} className="flex-none text-saffron-600" />
            <div>
              <div className="font-semibold">Share filled PDF</div>
              <div className="text-xs text-ink-500">{outputReady ? "Send via WhatsApp, email or another app" : "Generate the PDF first"}</div>
            </div>
          </button>

          <button
            className="flex w-full items-center gap-3 rounded-lg border border-paper-300 bg-white px-4 py-3 text-left font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            onClick={handleDownload} disabled={busy || !outputReady}
          >
            <Download size={18} className="flex-none text-ink-600" />
            <div>
              <div className="font-semibold">Download filled PDF</div>
              <div className="text-xs text-ink-500">{outputReady ? "Save to your device" : "Generate the PDF first"}</div>
            </div>
          </button>

          <button
            className="flex w-full items-center gap-3 rounded-lg border border-paper-300 bg-white px-4 py-3 text-left font-medium text-ink-700 hover:bg-ink-50"
            onClick={handleCopySummary}
          >
            <Copy size={18} className="flex-none text-ink-600" />
            <div>
              <div className="font-semibold">Copy field summary</div>
              <div className="text-xs text-ink-500">Plain text · account numbers and Aadhaar masked</div>
            </div>
          </button>

          <button
            className="flex w-full items-center gap-3 rounded-lg border border-paper-300 bg-white px-4 py-3 text-left font-medium text-ink-700 hover:bg-ink-50"
            onClick={handleCopyTranscript}
          >
            <Copy size={18} className="flex-none text-ink-600" />
            <div>
              <div className="font-semibold">Copy chat transcript</div>
              <div className="text-xs text-ink-500">Copy the conversation with the assistant</div>
            </div>
          </button>
        </div>

        {toast && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-leaf-50 px-3 py-2 text-sm font-medium text-leaf-700">
            <Check size={15} /> {toast}
          </div>
        )}
      </div>
    </div>
  );
}
