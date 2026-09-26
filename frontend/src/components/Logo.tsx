export default function Logo({ light = false, sub = true }: { light?: boolean; sub?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill={light ? "#ffffff" : "#0f4a37"} />
        <circle cx="16" cy="16" r="10.5" fill="none" stroke={light ? "#0f4a37" : "#ffffff"} strokeWidth="1" />
        <circle cx="16" cy="16" r="2" fill={light ? "#0f4a37" : "#ffffff"} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6;
          return <line key={i} x1={16 + 2 * Math.cos(a)} y1={16 + 2 * Math.sin(a)} x2={16 + 10.5 * Math.cos(a)} y2={16 + 10.5 * Math.sin(a)} stroke={light ? "#0f4a37" : "#ffffff"} strokeWidth="0.8" />;
        })}
      </svg>
      <div className="leading-tight">
        <div className={`font-display text-lg font-bold ${light ? "text-white" : "text-forest-800"}`}>Sahayak</div>
        {sub && <div className={`text-[0.7rem] font-semibold uppercase tracking-wider ${light ? "text-forest-200" : "text-ink-500"}`}>Public service assistant</div>}
      </div>
    </div>
  );
}
