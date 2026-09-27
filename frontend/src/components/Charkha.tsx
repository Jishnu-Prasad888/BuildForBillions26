/* A charkha (spinning wheel) loader: the wheel turns, the stand and thread stay put. Colour follows currentColor. */

const HUB = 28;
const RADIUS = 23;
// Four diameters = eight spokes, drawn as one path.
const SPOKES = Array.from({ length: 4 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const dx = Math.cos(a) * RADIUS;
  const dy = Math.sin(a) * RADIUS;
  return `M${(HUB - dx).toFixed(1)} ${(HUB - dy).toFixed(1)}L${(HUB + dx).toFixed(1)} ${(HUB + dy).toFixed(1)}`;
}).join("");

export function Charkha({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" className={`inline-block flex-none ${className}`} aria-hidden>
      <path d="M28 30 14 60M28 30 42 60M8 60H48M35 44H62" strokeWidth={3} />
      <path d="M62 44 51 28" strokeWidth={1.5} />
      <g className="animate-spin [animation-duration:2s]" style={{ transformOrigin: `${HUB}px ${HUB}px` }}>
        <circle cx={HUB} cy={HUB} r={RADIUS} strokeWidth={4} />
        <path d={SPOKES} strokeWidth={2.5} />
        <circle cx={HUB} cy={HUB} r={4} fill="currentColor" strokeWidth={0} />
      </g>
    </svg>
  );
}

/* Full-area loading state: the charkha centred in its container (the whole viewport by default). */
export function CharkhaLoader({ className = "h-screen" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center text-forest-600 ${className}`} role="status">
      <Charkha className="h-20 w-20" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
