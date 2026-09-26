import type { SplitHandle } from "@/hooks/useSplit";

/** The draggable divider between two columns. Callers set display (e.g. "hidden lg:flex") through className. */
export default function Splitter({ split, label, className = "" }: { split: SplitHandle; label: string; className?: string }) {
  return (
    <div
      {...split.handleProps}
      aria-label={label}
      className={`group w-3 flex-none cursor-col-resize touch-none items-center justify-center ${className}`}
    >
      <span
        className={`h-12 w-1 rounded-full transition-colors ${
          split.dragging ? "bg-forest-500" : "bg-ink-300 group-hover:bg-forest-300 group-focus-visible:bg-forest-500"
        }`}
      />
    </div>
  );
}
