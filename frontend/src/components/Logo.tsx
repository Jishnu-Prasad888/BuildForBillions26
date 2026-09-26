export default function Logo({ light = false, sub = true }: { light?: boolean; sub?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? "#ffffff" : "#14213d"} />
        <path d="M8 21c4-8.5 12-8.5 16 0" stroke="#d9731a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="11.5" r="3" fill={light ? "#14213d" : "#ffffff"} />
      </svg>
      <div className="leading-tight">
        <div className={`font-display text-lg font-bold ${light ? "text-white" : "text-ink-900"}`}>Sahayak</div>
        {sub && <div className={`text-[0.7rem] font-semibold uppercase tracking-wider ${light ? "text-ink-300" : "text-ink-500"}`}>Public service assistant</div>}
      </div>
    </div>
  );
}
