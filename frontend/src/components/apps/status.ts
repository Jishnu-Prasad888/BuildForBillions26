import type { Application } from "@/types";

/** Statuses in which the citizen can still edit the form. */
export const ACTIVE_STATUSES = ["IN_PROGRESS", "DRAFT", "DOCUMENTS_REQUIRED"];
export const isActive = (a: Pick<Application, "status">) => ACTIVE_STATUSES.includes(a.status);

export type Bucket = "active" | "submitted" | "approved";
export function bucketOf(status: string): Bucket {
  if (ACTIVE_STATUSES.includes(status)) return "active";
  return status === "APPROVED" ? "approved" : "submitted";
}

/** The journey every application follows; the first stage covers DRAFT / IN_PROGRESS / DOCUMENTS_REQUIRED. */
export const STAGES = [
  { id: "FILL", label: "Fill form" },
  { id: "SUBMITTED", label: "Submitted" },
  { id: "UNDER_REVIEW", label: "Under review" },
  { id: "FIELD_VERIFICATION", label: "Field check" },
  { id: "APPROVED", label: "Approved" },
];
export function stageIndex(status: string): number {
  const i = STAGES.findIndex((s) => s.id === status);
  return i < 0 ? 0 : i;
}

const STATUS_HINT: Record<string, string> = {
  SUBMITTED: "Recorded. Waiting for the department to pick it up.",
  UNDER_REVIEW: "The department is reviewing it.",
  FIELD_VERIFICATION: "A field verification is being arranged.",
  APPROVED: "Approved. Nothing more to do.",
};

export interface NextAction {
  label: string;
  to: string;
  hint: string;
  /** Opens the same form with the assistant's start dialog already showing. */
  assistTo?: string;
}

/** The single most useful thing to do next on an application. */
export function nextAction(a: Application): NextAction {
  const detail = `/applications/${a.id}`;
  if (isActive(a) && a.form_id) {
    if (a.progress >= 100) return { label: "Review & submit", to: `${detail}/review`, hint: "Every field is filled. Check your answers, then confirm." };
    const hint = a.status === "DOCUMENTS_REQUIRED" ? "Some documents are still needed." : a.next_section ? `Next section: ${a.next_section}` : "Fill it in yourself or let the assistant guide you.";
    return { label: a.progress > 0 ? "Continue form" : "Start form", to: `${detail}/form`, assistTo: `${detail}/form?assist=1`, hint };
  }
  if (isActive(a)) {
    const hint = a.status === "DOCUMENTS_REQUIRED" ? "Some documents are still needed. Add them, then apply on the official portal." : "Apply on the official portal, then keep your documents and notes here.";
    return { label: "Open tracker", to: detail, hint };
  }
  return { label: "Track status", to: detail, hint: STATUS_HINT[a.status] ?? "Waiting for a decision." };
}
