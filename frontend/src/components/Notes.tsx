import { Bot, Check, CheckSquare, CircleHelp, FileCheck2, FileX2, Pencil, Plus, Square, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/services/api";
import type { AINotes, Note } from "@/types";
import { useI18n } from "@/i18n";
import { formatDate } from "./ui";

export function UserNotesPanel({ notes, applicationId, onChange, title, bare = false }: { notes: Note[]; applicationId?: string; onChange: (n: Note[]) => void; title?: string; bare?: boolean }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"todo" | "question">("todo");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const add = async () => {
    if (!text.trim()) return;
    const n = await api.post<Note>("/api/notes", { content: text.trim(), item_type: kind, application_id: applicationId });
    onChange([...notes, n]);
    setText("");
  };
  const toggle = async (n: Note) => {
    const u = await api.patch<Note>(`/api/notes/${n.id}`, { done: !n.done });
    onChange(notes.map((x) => (x.id === n.id ? u : x)));
  };
  const save = async (n: Note) => {
    if (!draft.trim()) return;
    const u = await api.patch<Note>(`/api/notes/${n.id}`, { content: draft.trim() });
    onChange(notes.map((x) => (x.id === n.id ? u : x)));
    setEditing(null);
  };
  const remove = async (n: Note) => {
    await api.del(`/api/notes/${n.id}`);
    onChange(notes.filter((x) => x.id !== n.id));
  };

  const todos = notes.filter((n) => n.item_type !== "question");
  const questions = notes.filter((n) => n.item_type === "question");

  const row = (n: Note) => (
    <li key={n.id} className="group flex animate-popIn items-start gap-2 rounded-md px-1 py-1 transition-colors hover:bg-paper-100">
      {n.item_type === "question" ? (
        <CircleHelp size={17} className="mt-0.5 flex-none text-ink-400" />
      ) : (
        <button onClick={() => toggle(n)} aria-label={n.done ? "Mark not done" : "Mark done"} className="mt-0.5 flex-none text-ink-500 transition-transform hover:text-leaf active:scale-90">
          {n.done ? <CheckSquare size={17} className="text-leaf" /> : <Square size={17} />}
        </button>
      )}
      {editing === n.id ? (
        <div className="flex flex-1 gap-1">
          <input className="input py-1 text-sm" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save(n)} />
          <button className="btn-ghost btn-sm" onClick={() => save(n)} aria-label="Save"><Check size={15} /></button>
        </div>
      ) : (
        <span className={`flex-1 text-[0.93rem] transition-colors duration-300 ${n.done ? "text-ink-400 line-through" : "text-ink-800"}`}>
          {n.content}
          {n.origin === "ai_suggested" && <span className="ml-1.5 align-middle text-[0.65rem] font-bold uppercase text-amber-600">AI suggested</span>}
        </span>
      )}
      {editing !== n.id && (
        <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button className="rounded p-1 text-ink-400 hover:text-ink-800" onClick={() => { setEditing(n.id); setDraft(n.content); }} aria-label="Edit"><Pencil size={14} /></button>
          <button className="rounded p-1 text-ink-400 hover:text-brick" onClick={() => remove(n)} aria-label="Delete"><Trash2 size={14} /></button>
        </span>
      )}
    </li>
  );

  return (
    <section className="card p-4">
      {!bare && (
        <div className="mb-2 flex items-center gap-2">
          <StickyNote size={18} className="text-saffron-600" />
          <h3 className="font-semibold uppercase tracking-wide text-ink-800">{title ?? t("my_notes")}</h3>
        </div>
      )}
      <div className={`eyebrow ${bare ? "" : "mt-2"}`}>Things I need</div>
      <ul className="mt-1 space-y-0.5">{todos.length ? todos.map(row) : <li className="px-1 py-1 text-sm text-ink-400">Nothing yet.</li>}</ul>
      <div className="eyebrow mt-3">Questions</div>
      <ul className="mt-1 space-y-0.5">{questions.length ? questions.map(row) : <li className="px-1 py-1 text-sm text-ink-400">No questions yet.</li>}</ul>
      <div className="mt-3 flex gap-1.5">
        <select className="input w-auto px-2 py-1.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value as any)} aria-label="Note type">
          <option value="todo">To-do</option>
          <option value="question">Question</option>
        </select>
        <input className="input py-1.5 text-sm" placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-secondary btn-sm" onClick={add} aria-label="Add note"><Plus size={16} /></button>
      </div>
    </section>
  );
}

export function AINotesPanel({ data, flash }: { data?: AINotes | null; flash?: boolean }) {
  const { t } = useI18n();
  if (!data) return null;
  return (
    <section className={`card p-4 ${flash ? "animate-flash" : ""}`} aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-ink-600" />
          <h3 className="font-semibold uppercase tracking-wide text-ink-800">{t("ai_notes")}</h3>
        </div>
        <span className="text-[0.7rem] text-ink-400">auto · {formatDate(data.updated_at, true)}</span>
      </div>
      <div className="eyebrow">Application</div>
      <div className="mb-2 text-[0.95rem] font-semibold text-ink-900">{data.application} · {data.progress}%</div>
      {data.completed.length > 0 && (
        <>
          <div className="eyebrow">Completed</div>
          <ul className="mb-2 text-sm">{data.completed.map((c) => <li key={c} className="text-leaf-700">✓ {c}</li>)}</ul>
        </>
      )}
      {(data.pending.length > 0 || data.skipped.length > 0) && (
        <>
          <div className="eyebrow">Pending</div>
          <ul className="mb-2 text-sm text-ink-700">
            {data.skipped.map((c) => <li key={c}>• {c} <span className="text-xs font-semibold text-amber-600">(later)</span></li>)}
            {data.pending.slice(0, 6).map((c) => <li key={c}>• {c}</li>)}
            {data.pending.length > 6 && <li className="text-ink-400">+{data.pending.length - 6} more</li>}
          </ul>
        </>
      )}
      {data.documents.length > 0 && (
        <>
          <div className="eyebrow">Documents</div>
          <ul className="mb-2 space-y-0.5 text-sm">
            {data.documents.map((d) => (
              <li key={d.code} className={`flex items-start gap-1.5 ${d.available ? "text-leaf-700" : "text-ink-600"}`}>
                {d.available ? <FileCheck2 size={15} className="mt-0.5 flex-none" /> : <FileX2 size={15} className="mt-0.5 flex-none text-brick" />}
                <span>{d.name}{!d.available && <span className="text-xs text-brick"> — not in wallet</span>}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {data.questions.length > 0 && (
        <>
          <div className="eyebrow">Open questions</div>
          <ul className="text-sm text-ink-700">{data.questions.map((q) => <li key={q}>? {q}</li>)}</ul>
        </>
      )}
    </section>
  );
}
