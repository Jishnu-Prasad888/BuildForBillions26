import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { AINotes, Application, Note } from "@/types";
import { AINotesPanel, UserNotesPanel } from "@/components/Notes";
import { ArrowRight, Bot, Sparkles, StickyNote } from "lucide-react";
import { EmptyState, PageHeader, SkeletonList } from "@/components/ui";

export default function Notes() {
  const { t } = useI18n();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  useEffect(() => {
    api.get<Note[]>("/api/notes").then(setNotes);
    api.get<Application[]>("/api/applications").then(setApps);
  }, []);
  const user = (notes ?? []).filter((n) => n.kind === "USER");
  const ai = (notes ?? []).filter((n) => n.kind === "AI");
  return (
    <div>
      <PageHeader eyebrow="Your notebook" title={t("notes")} subtitle="Your own notes are yours to edit. AI notes are generated from your application progress and are never mixed with yours." />
      {notes === null ? <div className="grid gap-6 lg:grid-cols-2"><SkeletonList rows={1} className="h-64" /><SkeletonList rows={2} className="h-40" /></div> : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="animate-riseIn">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><StickyNote size={19} className="text-saffron-600" /> {t("my_notes")}
              <span className="text-sm font-normal text-ink-500">· only you edit these</span></h2>
            <UserNotesPanel bare notes={user} onChange={(u) => setNotes([...u, ...ai])} />
          </section>
          <section className="animate-riseIn" style={{ animationDelay: "120ms" }}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Bot size={19} className="text-forest-600" /> {t("ai_notes")}
              <span className="text-sm font-normal text-ink-500">· updated automatically</span></h2>
            {ai.length === 0 && <EmptyState icon={<Sparkles size={22} />} title="No AI notes yet">They appear here once you start an application.</EmptyState>}
            <div className="stagger space-y-4">
              {ai.map((n) => {
                const a = apps.find((x) => x.id === n.application_id);
                return (
                  <div key={n.id}>
                    {a && <Link to={`/applications/${a.id}`} className="group mb-1.5 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:text-forest-900">{a.scheme_name} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></Link>}
                    <AINotesPanel data={n.data as AINotes} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
