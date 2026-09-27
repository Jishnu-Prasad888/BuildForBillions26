import { Bot, Plus, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import type { FormAINotes, FormUserNote } from "@/types";

/* AI Notes (derived from the form's state, read-only) and My Notes (the citizen's own) are separate and never mix. */
export default function FormNotes({ formId, aiNotes }: { formId: string; aiNotes: FormAINotes }) {
  const [notes, setNotes] = useState<FormUserNote[]>([]);
  const [text, setText] = useState("");
  const load = useCallback(() => api.get<{ user_notes: FormUserNote[] }>(`/api/forms/${formId}/notes`).then((r) => setNotes(r.user_notes)).catch(() => undefined), [formId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!text.trim()) return;
    const n = await api.post<FormUserNote>(`/api/forms/${formId}/notes`, { content: text.trim() });
    setNotes((x) => [...x, n]);
    setText("");
  };
  return (
    <div className="min-h-0 space-y-5 overflow-y-auto px-3 py-3">
      <section className="rounded-xl border border-paper-300 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-2 font-medium text-ink-900"><Bot size={16} className="text-saffron-600" /> AI Notes <span className="chip bg-ink-100 text-ink-600">automatic</span></h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-500">Form</dt><dd className="truncate font-medium">{aiNotes.form}</dd>
          <dt className="text-ink-500">Detected</dt><dd className="font-medium">{aiNotes.detected} fields</dd>
          <dt className="text-ink-500">Completed</dt><dd className="font-medium">{aiNotes.completed}</dd>
          <dt className="text-ink-500">Pending</dt><dd className="font-medium">{aiNotes.pending}</dd>
          <dt className="text-ink-500">Clarification needed</dt><dd className="font-medium">{aiNotes.clarification_needed}</dd>
        </dl>
        {aiNotes.notes.length > 0 && <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-ink-700">{aiNotes.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      </section>
      <section className="rounded-xl border border-paper-300 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-2 font-medium text-ink-900"><UserRound size={16} className="text-ink-500" /> My Notes</h3>
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={n.done} aria-label="Done" onChange={async (e) => { const u = await api.patch<FormUserNote>(`/api/forms/${formId}/notes/${n.id}`, { done: e.target.checked }); setNotes((x) => x.map((y) => (y.id === n.id ? u : y))); }} />
              <span className={`flex-1 whitespace-pre-wrap break-words ${n.done ? "text-ink-400 line-through" : ""}`}>{n.content}</span>
              <button className="text-ink-400 hover:text-brick" aria-label="Delete note" onClick={async () => { await api.del(`/api/forms/${formId}/notes/${n.id}`); setNotes((x) => x.filter((y) => y.id !== n.id)); }}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex gap-2">
          <textarea className="input min-h-[2.75rem] py-2 text-sm" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
            placeholder="e.g. Need to find survey number." aria-label="New note" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }} />
          <button className="btn-primary h-11 px-3" onClick={add} disabled={!text.trim()} aria-label="Add note"><Plus size={17} /></button>
        </div>
      </section>
    </div>
  );
}
