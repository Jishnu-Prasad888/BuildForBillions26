import { FileText, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { KnowledgeDoc } from "@/types";
import { EmptyState, PageHeader, SkeletonList, StatusPill, formatDate } from "@/components/ui";
import UploadModal from "./UploadModal";
import DocDrawer from "./DocDrawer";

export default function Documents() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [upload, setUpload] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const load = () => api.get<KnowledgeDoc[]>("/api/admin/documents").then((r) => { setDocs(r); setLoaded(true); });
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <PageHeader eyebrow="Knowledge base" title="Documents" subtitle="Every document the assistant can cite. Click one to see its chunks and provenance."
        actions={<button className="btn-primary" onClick={() => setUpload(true)}><Upload size={16} /> Upload document</button>} />
      {!loaded ? (
        <SkeletonList rows={5} className="h-14" />
      ) : docs.length === 0 ? (
        <EmptyState icon={<FileText size={22} />} title="No documents yet">
          Upload the first document the assistant can cite as evidence.
          <button className="btn-primary btn-sm mt-4" onClick={() => setUpload(true)}><Upload size={15} /> Upload document</button>
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-paper-300 text-xs font-medium uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-medium">Title</th><th className="px-4 py-3 font-medium">Publisher</th><th className="px-4 py-3 font-medium">Kind</th><th className="px-4 py-3 font-medium">Schemes</th><th className="px-4 py-3 text-right font-medium">Chunks</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-300">
              {docs.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-ink-50" onClick={() => setSel(d.id)}>
                  <td className="px-4 py-3 font-medium text-ink-900">{d.title}{d.is_demo && <span className="chip ml-2 bg-amber-50 text-amber-700">demo</span>}</td>
                  <td className="px-4 py-3 text-ink-600">{d.publisher}</td>
                  <td className="px-4 py-3">{d.kind}</td>
                  <td className="px-4 py-3 text-xs text-ink-600">{d.scheme_codes.join(", ")}</td>
                  <td className="px-4 py-3 text-right font-mono">{d.chunk_count}</td>
                  <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <UploadModal open={upload} onClose={() => setUpload(false)} onStarted={() => load()} />
      <DocDrawer docId={sel} onClose={() => setSel(null)} onChanged={load} />
    </div>
  );
}
