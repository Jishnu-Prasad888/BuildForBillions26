import { ArrowLeft, CheckCircle2, Eye, EyeOff, FileText, Pencil, PartyPopper, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { Application, ApplicationDetail } from "@/types";
import { displayValue, fieldLabel, isFilled } from "@/components/formUtils";
import { LoadError, Skeleton } from "@/components/apps/Skeleton";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";

export default function Review() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang } = useI18n();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Application | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    api.get<ApplicationDetail>(`/api/applications/${id}`).then(setApp).catch((e) => setLoadError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (loadError) return <LoadError message={loadError} onRetry={load} />;
  if (!app) return <div className="space-y-4" role="status" aria-label="Loading"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (!app.form) return <EmptyState icon={<FileText size={22} />} title="This application has no online form">There is nothing to review. <Link to={`/applications/${id}`} className="link">Back to the application</Link></EmptyState>;

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
        <h1 className="page-title">Application recorded</h1>
        <p className="mt-2 text-ink-600">Reference number</p>
        <div className="mt-1 font-mono text-xl font-medium text-ink-900">{done.reference_number}</div>
        <p className="mx-auto mt-4 max-w-md rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Demo mode: this submission is recorded in the prototype only. It was <span className="font-medium">not</span> sent to any government portal.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => nav(`/applications/${id}`)}>Track this application</button>
          <button className="btn-secondary" onClick={() => nav("/applications")}>My applications</button>
        </div>
      </div>
    );

  return (
    <div>
      <Link to={`/applications/${id}/form`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"><ArrowLeft size={15} /> Back to form</Link>
      <PageHeader eyebrow="Final review" title={app.scheme_name} subtitle="Check every answer carefully. Nothing is submitted until you confirm below."
        actions={<button className="btn-secondary btn-sm" onClick={() => setReveal((r) => !r)}>{reveal ? <EyeOff size={15} /> : <Eye size={15} />} {reveal ? "Hide" : "Show"} sensitive numbers</button>} />

      {missing.length > 0 && (
        <div className="mb-6 flex gap-3 rounded-xl border border-brick-100 bg-brick-50 p-4 text-brick" role="alert">
          <TriangleAlert size={20} className="mt-0.5 flex-none" />
          <div>
            <div className="font-medium">{missing.length} required {missing.length === 1 ? "field is" : "fields are"} still empty</div>
            <p className="mt-0.5 text-sm">{missing.map((f) => fieldLabel(f, lang, app.form_data)).join(", ")}. <Link to={`/applications/${id}/form`} className="font-medium underline">Go back and finish them</Link>.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {app.form.sections.map((s, i) => (
          <section key={s.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-paper-300 bg-paper-100 px-5 py-3">
              <h2 className="font-medium text-ink-900"><span className="mr-2 text-forest-600">{i + 1}.</span>{s.titles?.[lang] || s.title}</h2>
              <Link to={`/applications/${id}/form`} className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-ink-900"><Pencil size={14} /> Edit</Link>
            </div>
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
              {s.fields.map((f) => {
                const v = app.form_data[f.id];
                const ok = isFilled(f, v);
                return (
                  <div key={f.id}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{fieldLabel(f, lang, app.form_data)}</dt>
                    <dd className={`mt-0.5 flex items-center gap-1.5 break-words text-[0.95rem] ${ok ? "text-ink-900" : f.required ? "text-brick" : "text-ink-400"}`}>
                      {ok && <CheckCircle2 size={15} className="flex-none text-leaf" />}{ok ? displayValue(f, v, lang, !reveal) : f.required ? "Missing" : "Not filled (optional)"}
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
          <ErrorNote>Complete the required fields above before you can submit.</ErrorNote>
        ) : (
          <>
            <label className="flex items-start gap-3 text-[0.95rem]">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-forest-600" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              <span>I have checked the information above and confirm it is correct. I understand this is a <span className="font-medium">demo</span> and the application is <span className="font-medium">not</span> sent to any government portal.</span>
            </label>
            <div className="mt-2"><ErrorNote>{err}</ErrorNote></div>
            <button className="btn-primary btn-lg mt-4 w-full sm:w-auto" disabled={!confirm || busy} onClick={submit}>{busy && <Spinner />} Confirm &amp; submit (demo)</button>
          </>
        )}
      </div>
    </div>
  );
}
