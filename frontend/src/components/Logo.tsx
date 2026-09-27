export default function Logo({ light = false, sub = true }: { light?: boolean; sub?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" aria-hidden className="h-10 w-10 flex-none object-contain" />
      <div className="leading-tight">
        <div className={`text-lg font-medium tracking-tight ${light ? "text-white" : "text-ink-900"}`}>Sahayak</div>
        {sub && <div className={`whitespace-nowrap text-[0.62rem] font-medium uppercase tracking-wide ${light ? "text-forest-100" : "text-ink-500"}`}>Public service assistant</div>}
      </div>
    </div>
  );
}
