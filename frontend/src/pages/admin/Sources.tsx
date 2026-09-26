import { Globe } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/services/api";
import type { IngestionJob, KnowledgeDoc } from "@/types";
import { useJobPolling } from "@/hooks/useJobPolling";
import { ErrorNote, PageHeader, Spinner, StatusPill, formatDate } from "@/components/ui";
import PipelineViz from "./PipelineViz";

interface Source { id: string; name: string; publisher: string; base_url?: string | null; category: string; is_official: boolean; is_demo: boolean; documents: number; created_at: string }

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const load = () => api.get<Source[]>("/api/admin/sources").then(setSources);
  const job = useJobPolling(jobId, () => load());
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api.post<{ job: IngestionJob; document: KnowledgeDoc }>("/api/admin/sources", { url, title: title || undefined, publisher: publisher || undefined });
      setJobId(r.job.id);
      setUrl("");
      setTitle("");
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Knowledge base" title="Sources" subtitle="Official websites and publishers. Add an official page URL to fetch, clean and index it." />
      <form onSubmit={submit} className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Globe size={19} className="text-saffron-600" /> Fetch &amp; index a web page</h2>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <input className="input" type="url" required placeholder="https://example.gov.in/scheme-guidelines" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" placeholder="Publisher (optional)" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </div>
        <p className="text-xs text-ink-500">Prefer government ministries, state departments, official scheme portals and official bank pages. Navigation and boilerplate are stripped automatically.</p>
        <ErrorNote>{err}</ErrorNote>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Fetch &amp; index</button>
        {job && (
          <div className="pt-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">{job.title} <StatusPill status={job.status} /></div>
            <PipelineViz status={job.status} stages={job.stages} />
            {job.error && <p className="mt-2 text-sm text-brick">{job.error}</p>}
          </div>
        )}
      </form>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-paper-300 bg-paper-100 text-xs uppercase tracking-wide text-ink-500">
            <tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Publisher</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Trust</th><th className="px-4 py-3 text-right">Docs</th><th className="px-4 py-3">Added</th></tr>
          </thead>
          <tbody className="divide-y divide-paper-300">
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-semibold">{s.name}</td>
                <td className="px-4 py-3 text-ink-600">{s.publisher}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-xs">{s.base_url}</td>
                <td className="px-4 py-3">{s.is_official ? <span className="chip bg-leaf-50 text-leaf-700">official</span> : <span className="chip bg-ink-100 text-ink-600">unverified</span>}{s.is_demo && <span className="chip ml-1 bg-saffron-50 text-saffron-700">demo</span>}</td>
                <td className="px-4 py-3 text-right font-mono">{s.documents}</td>
                <td className="px-4 py-3 text-ink-500">{formatDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
