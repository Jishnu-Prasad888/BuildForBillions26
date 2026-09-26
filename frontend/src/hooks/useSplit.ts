import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Three resizable columns: a left panel, a flexible centre, a right panel. Only the two side widths are stored;
 * the centre takes the rest and never drops below `centerMin`. When the sides no longer fit, the side that is not
 * being dragged gives way (and springs back when there is room again). Sizes are remembered in localStorage;
 * double-clicking a divider restores that side's default.
 */
interface Options {
  storageKey: string;
  /** Default side widths as a fraction of the container width. */
  leftDefault: number;
  rightDefault: number;
  leftMin: number;
  rightMin: number;
  centerMin: number;
  /** Thickness of each divider (px). */
  gutter?: number;
}

type Side = "left" | "right";
type Stored = { left: number | null; right: number | null };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function read(key: string): Stored {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "null");
    const ok = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    return { left: ok(raw?.left), right: ok(raw?.right) };
  } catch { return { left: null, right: null }; }
}

function write(key: string, value: Stored) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* blocked storage: just not remembered */ }
}

export function useColumns({ storageKey, leftDefault, rightDefault, leftMin, rightMin, centerMin, gutter = 12 }: Options) {
  // A callback ref, so the container can appear late (the workspace renders it only once the form has loaded).
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const [stored, setStored] = useState<Stored>(() => read(storageKey));
  const [drag, setDrag] = useState<{ side: Side; pos: number; size: number } | null>(null);

  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  const avail = Math.max(0, width - 2 * gutter); // room for the three panes
  const leftMax = Math.max(leftMin, avail - centerMin - rightMin);
  const rightMax = Math.max(rightMin, avail - centerMin - leftMin);
  let left = clamp(stored.left ?? leftDefault * width, leftMin, leftMax);
  let right = clamp(stored.right ?? rightDefault * width, rightMin, rightMax);
  const over = left + right - (avail - centerMin);
  if (width && over > 0) {
    if (drag?.side === "left") right = Math.max(rightMin, right - over);
    else left = Math.max(leftMin, left - over);
  }

  useEffect(() => { // no accidental text selection while dragging
    document.body.classList.toggle("select-none", !!drag);
    return () => document.body.classList.remove("select-none");
  }, [drag]);

  const sizeOf = (side: Side) => (side === "left" ? left : right);
  const limits = (side: Side) => (side === "left" ? [leftMin, leftMax] : [rightMin, rightMax]);
  const set = (side: Side, value: number, persist: boolean) => {
    const [lo, hi] = limits(side);
    setStored((s) => {
      const next = { ...s, [side]: clamp(value, lo, hi) };
      if (persist) write(storageKey, next);
      return next;
    });
  };

  const handle = (side: Side) => {
    const [lo, hi] = limits(side);
    const size = sizeOf(side);
    // The left panel grows as its divider moves right; the right panel grows as its divider moves left.
    const sign = side === "left" ? 1 : -1;
    const onPointerDown = (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ side, pos: e.clientX, size });
    };
    const onPointerMove = (e: PointerEvent<HTMLElement>) => {
      if (drag?.side === side) set(side, drag.size + sign * (e.clientX - drag.pos), false);
    };
    const endDrag = (e: PointerEvent<HTMLElement>) => {
      if (drag?.side !== side) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      setDrag(null);
      write(storageKey, stored);
    };
    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
      const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";
      const step = e.shiftKey ? 96 : 24;
      if (e.key === grow) set(side, size + step, true);
      else if (e.key === shrink) set(side, size - step, true);
      else if (e.key === "Home") set(side, lo, true);
      else if (e.key === "End") set(side, hi, true);
      else return;
      e.preventDefault();
    };
    const onDoubleClick = () => {
      const next = { ...stored, [side]: null };
      setStored(next);
      write(storageKey, next);
    };
    return {
      dragging: drag?.side === side,
      handleProps: {
        role: "separator" as const,
        tabIndex: 0,
        "aria-orientation": "vertical" as const,
        "aria-valuemin": lo,
        "aria-valuemax": hi,
        "aria-valuenow": Math.round(size),
        title: "Drag to resize · double-click to reset",
        onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown, onDoubleClick,
      },
    };
  };

  return { containerRef: setEl, leftWidth: left, rightWidth: right, left: handle("left"), right: handle("right") };
}

export type SplitHandle = ReturnType<typeof useColumns>["left"];
