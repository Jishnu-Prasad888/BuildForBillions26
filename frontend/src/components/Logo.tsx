export default function Logo({ light = false, sub = true }: { light?: boolean; sub?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" aria-hidden className="h-11 w-11 flex-none object-contain" />
      <div className="leading-tight">
        <div className={`font-display text-lg font-bold ${light ? "text-white" : "text-forest-800"}`}>Sahayak</div>
        {sub && <div className={`text-[0.7rem] font-semibold uppercase tracking-wider ${light ? "text-forest-200" : "text-ink-500"}`}>Public service assistant</div>}
      </div>
    </div>
  );
}
