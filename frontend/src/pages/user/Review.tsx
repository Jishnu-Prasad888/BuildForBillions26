import { CheckCircle2, Eye, EyeOff, Pencil, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { Application, ApplicationDetail } from "@/types";
import { displayValue, fieldLabel, isFilled } from "@/components/formUtils";
import { ErrorNote, PageHeader, Spinner } from "@/components/ui";

export default function Review() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang } = useI18n();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Application | null>(null);

  useEffect(() => {
    api.get<ApplicationDetail>(`/api/applications/${id}`).then(setApp);
  }, [id]);

  if (!app) return <Spinner className="h-6 w-6" />;
  if (!app.form) return <p>This application has no form.</p>;
  const missing = app.form.sections.flatMap((s) => s.fields.filter((f) => f.required && !isFilled(f, app.form_data[f.id])));

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      setDone(await api.post<Application>(`/api/applications/${id}/submit`, { confirm: true }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-leaf-50 text-leaf"><PartyPopper size={32} /></div>
        <h1 className="font-display text-3xl font-bold">Application recorded</h1>
        <p className="mt-2 text-ink-600">Reference number</p>
        <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{done.reference_number}</div>
        <p className="mx-auto mt-4 max-w-md rounded-lg border border-saffron-100 bg-saffron-50 px-4 py-3 text-sm text-saffron-700">
          Demo mode: this submission is recorded in the prototype only. It was <b>not</b> sent to any government portal.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => nav(`/applications/${id}`)}>Track this application</button>
          <button className="btn-secondary" onClick={() => nav("/applications")}>My applications</button>
        </div>
      </div>
    );

  return (
    <div>
      <Link to={`/applications/${id}/form`} className="text-sm font-semibold text-ink-600">← Back to form</Link>
      <PageHeader eyebrow="Final review" title={app.scheme_name} subtitle="Check every answer carefully. Nothing is submitted until you confirm below."
        actions={<button className="btn-secondary btn-sm" onClick={() => setReveal((r) => !r)}>{reveal ? <EyeOff size={15} /> : <Eye size={15} />} {reveal ? "Hide" : "Show"} sensitive numbers</button>} />
      <div className="space-y-4">
        {app.form.sections.map((s, i) => (
          <section key={s.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-paper-300 bg-paper-100 px-5 py-3">
              <h2 className="font-bold"><span className="mr-2 text-saffron-600">{i + 1}.</span>{s.titles?.[lang] || s.title}</h2>
              <Link to={`/applications/${id}/form`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900"><Pencil size={14} /> Edit</Link>
            </div>
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
              {s.fields.map((f) => {
                const v = app.form_data[f.id];
                const ok = isFilled(f, v);
                return (
                  <div key={f.id}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{fieldLabel(f, lang, app.form_data)}</dt>
                    <dd className={`mt-0.5 flex items-center gap-1.5 text-[1.02rem] ${ok ? "text-ink-900" : "text-brick"}`}>
                      {ok && <CheckCircle2 size={15} className="text-leaf" />}{ok ? displayValue(f, v, lang, !reveal) : "Missing"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      <div className="card mt-6 p-5">
        {missing.length > 0 ? (
          <ErrorNote>Please complete {missing.length} required field(s) before submitting: {missing.map((f) => f.label).join(", ")}.</ErrorNote>
        ) : (
          <>
            <label className="flex items-start gap-3 text-[1.02rem]">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-ink-800" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              <span>I have checked the information above and confirm it is correct. I understand this is a <b>demo</b> and the application is <b>not</b> sent to any government portal.</span>
            </label>
            <div className="mt-2"><ErrorNote>{err}</ErrorNote></div>
            <button className="btn-accent mt-4 px-6 py-3 text-base" disabled={!confirm || busy} onClick={submit}>{busy && <Spinner />} Confirm &amp; submit (demo)</button>
          </>
        )}
      </div>
    </div>
  );
}
