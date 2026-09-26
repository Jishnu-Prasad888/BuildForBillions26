import { Check } from "lucide-react";
import { STAGES, stageIndex } from "./status";

/** Where an application is on its journey, from filling the form to approval. */
export default function StatusSteps({ status, guided = true }: { status: string; guided?: boolean }) {
  const at = stageIndex(status);
  return (
    <ol className="grid grid-cols-5" aria-label="Application stages">
      {STAGES.map((s, i) => {
        const done = i < at || (i === at && status === "APPROVED");
        const current = i === at && !done;
        return (
          <li key={s.id} className="relative flex flex-col items-center px-0.5 text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && <span className={`absolute right-1/2 top-[13px] h-0.5 w-full ${i <= at ? "bg-forest-600" : "bg-ink-200"}`} aria-hidden />}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                done ? "border-forest-600 bg-forest-600 text-white" : current ? "border-forest-600 bg-white text-forest-700 ring-4 ring-forest-100" : "border-ink-200 bg-white text-ink-400"
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[0.68rem] font-semibold leading-tight sm:text-xs ${current ? "text-ink-900" : done ? "text-ink-700" : "text-ink-400"}`}>{i === 0 && !guided ? "Apply on portal" : s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
