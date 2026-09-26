import { FileText, Landmark, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Application } from "@/types";
import { ProgressBar, StatusPill, formatDate } from "@/components/ui";
import { nextAction } from "./status";

interface Cta { label: string; to: string; icon?: ReactNode }
interface Props {
  icon: ReactNode;
  tag?: string;
  title: string;
  titleTo?: string;
  meta?: ReactNode;
  status?: ReactNode;
  /** 0-100; leave undefined when there is no meaningful percentage. */
  progress?: number;
  hint?: ReactNode;
  primary?: Cta;
  secondary?: Cta;
  /** Extra controls after the buttons, e.g. delete or retry. */
  actions?: ReactNode;
}

/** One card style for everything the citizen works on: applications on /applications, and applications plus uploads on /forms. */
export function WorkCard({ icon, tag, title, titleTo, meta, status, progress, hint, primary, secondary, actions }: Props) {
  const heading = <span className="break-words">{title}</span>;
  return (
    <article className="card flex flex-col gap-3 p-4 transition-shadow hover:shadow-lift sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-forest-50 text-forest-700">{icon}</div>
        <div className="min-w-0 flex-1">
          {tag && <div className="eyebrow">{tag}</div>}
          <h3 className="font-display text-[1.05rem] font-bold leading-snug text-ink-900">
            {titleTo ? <Link to={titleTo} className="hover:text-forest-700 hover:underline">{heading}</Link> : heading}
          </h3>
          {meta && <div className="mt-0.5 text-sm text-ink-500">{meta}</div>}
          {/* On phones the status drops under the title so the title keeps its width. */}
          {status && <div className="mt-2 sm:hidden">{status}</div>}
        </div>
        {status && <div className="hidden flex-none sm:block">{status}</div>}
      </div>
      {progress !== undefined && (
        <div className="flex items-center gap-3">
          <ProgressBar value={progress} />
          <span className="w-10 text-right text-sm font-semibold text-ink-700">{progress}%</span>
        </div>
      )}
      {hint && <p className="text-sm text-ink-600">{hint}</p>}
      {(primary || secondary || actions) && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {primary && <Link to={primary.to} className="btn-primary btn-sm">{primary.icon}{primary.label}</Link>}
          {secondary && <Link to={secondary.to} className="btn-secondary btn-sm">{secondary.icon}{secondary.label}</Link>}
          {actions}
        </div>
      )}
    </article>
  );
}

export function ApplicationCard({ app }: { app: Application }) {
  const na = nextAction(app);
  const guided = !!app.form_id;
  return (
    <WorkCard
      icon={guided ? <FileText size={20} /> : <Landmark size={20} />}
      tag={guided ? "Guided form" : "Portal application"}
      title={app.scheme_name}
      titleTo={`/applications/${app.id}`}
      meta={`${app.reference_number ? `Ref ${app.reference_number} · ` : ""}Updated ${formatDate(app.updated_at)}`}
      status={<StatusPill status={app.status} />}
      progress={guided || app.progress > 0 ? app.progress : undefined}
      hint={na.hint}
      primary={{ label: na.label, to: na.to }}
      secondary={na.assistTo ? { label: "Help me fill", to: na.assistTo, icon: <Sparkles size={15} className="text-forest-600" /> } : undefined}
    />
  );
}
