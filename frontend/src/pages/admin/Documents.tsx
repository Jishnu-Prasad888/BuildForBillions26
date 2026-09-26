import { Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { KnowledgeDoc } from "@/types";
import { PageHeader, StatusPill, formatDate } from "@/components/ui";
import UploadModal from "./UploadModal";
import DocDrawer from "./DocDrawer";

export default function Documents() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [upload, setUpload] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const load = () => api.get<KnowledgeDoc[]>("/api/admin/documents").then(setDocs);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <PageHeader eyebrow="Knowledge base" title="Documents" subtitle="Every document the assistant can cite. Click one to see its chunks and provenance."
        actions={<button className="btn-primary" onClick={() => setUpload(true)}><Upload size={16} /> Upload document</button>} />
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-paper-300 bg-paper-100 text-xs uppercase tracking-wide text-ink-500">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Publisher</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Schemes</th><th className="px-4 py-3 text-right">Chunks</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Added</th></tr>
          </thead>
          <tbody className="divide-y divide-paper-300">
            {docs.map((d) => (
              <tr key={d.id} className="cursor-pointer hover:bg-paper-100" onClick={() => setSel(d.id)}>
                <td className="px-4 py-3 font-semibold text-ink-900">{d.title}{d.is_demo && <span className="chip ml-2 bg-amber-50 text-amber-700">demo</span>}</td>
                <td className="px-4 py-3 text-ink-600">{d.publisher}</td>
                <td className="px-4 py-3">{d.kind}</td>
                <td className="px-4 py-3 text-xs">{d.scheme_codes.join(", ")}</td>
                <td className="px-4 py-3 text-right font-mono">{d.chunk_count}</td>
                <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                <td className="px-4 py-3 text-ink-500">{formatDate(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UploadModal open={upload} onClose={() => setUpload(false)} onStarted={() => load()} />
      <DocDrawer docId={sel} onClose={() => setSel(null)} onChanged={load} />
    </div>
  );
}
