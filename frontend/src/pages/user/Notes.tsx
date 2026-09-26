import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { AINotes, Application, Note } from "@/types";
import { AINotesPanel, UserNotesPanel } from "@/components/Notes";
import { PageHeader } from "@/components/ui";

export default function Notes() {
  const { t } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  useEffect(() => {
    api.get<Note[]>("/api/notes").then(setNotes);
    api.get<Application[]>("/api/applications").then(setApps);
  }, []);
  const user = notes.filter((n) => n.kind === "USER");
  const ai = notes.filter((n) => n.kind === "AI");
  return (
    <div>
      <PageHeader eyebrow="Your notebook" title={t("notes")} subtitle="Your own notes are yours to edit. AI notes are generated from your application progress and are never mixed with yours." />
      <div className="grid gap-6 lg:grid-cols-2">
        <UserNotesPanel notes={user} onChange={(u) => setNotes([...u, ...ai])} />
        <div className="space-y-4">
          {ai.length === 0 && <p className="text-sm text-ink-500">AI notes appear once you start an application.</p>}
          {ai.map((n) => {
            const a = apps.find((x) => x.id === n.application_id);
            return (
              <div key={n.id}>
                {a && <Link to={`/applications/${a.id}`} className="mb-1 block text-sm font-semibold text-ink-600">{a.scheme_name} →</Link>}
                <AINotesPanel data={n.data as AINotes} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
