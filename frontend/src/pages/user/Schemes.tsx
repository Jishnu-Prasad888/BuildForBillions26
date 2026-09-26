import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { SchemeCard as S } from "@/types";
import SchemeCard from "@/components/SchemeCard";
import { PageHeader } from "@/components/ui";

export default function Schemes() {
  const { lang, t } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [schemes, setSchemes] = useState<S[]>([]);
  const [q, setQ] = useState("");
  const formOnly = params.get("form") === "1";

  useEffect(() => {
    api.get<S[]>(`/api/schemes?lang=${lang}`).then(setSchemes);
  }, [lang]);

  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return schemes.filter((x) => (!formOnly || x.form_id) && (!s || `${x.display_name} ${x.name} ${x.summary}`.toLowerCase().includes(s)));
  }, [schemes, q, formOnly]);

  return (
    <div>
      <PageHeader eyebrow="From the knowledge graph" title={t("schemes")}
        subtitle={formOnly ? "Choose a scheme with a guided form. The assistant will help you fill it field by field." : "Schemes linked to life events in the knowledge graph. Not sure which applies? Describe your situation to the assistant."}
        actions={<button className="btn-accent" onClick={() => nav("/assistant")}>{t("talk_assistant")}</button>} />
      <div className="relative mb-5 max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input pl-10" placeholder="Search schemes" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((s) => <SchemeCard key={s.code} scheme={s} />)}
      </div>
    </div>
  );
}
