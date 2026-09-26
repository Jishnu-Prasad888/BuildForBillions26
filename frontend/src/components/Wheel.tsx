export default function Wheel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * Math.PI) / 12;
        const b = a + Math.PI / 24;
        const c = a + Math.PI / 12;
        return (
          <g key={i} stroke="currentColor" strokeWidth="0.6" fill="none">
            <line x1={50 + 7 * Math.cos(a)} y1={50 + 7 * Math.sin(a)} x2={50 + 46 * Math.cos(a)} y2={50 + 46 * Math.sin(a)} />
            <polygon points={`${50 + 46 * Math.cos(a)},${50 + 46 * Math.sin(a)} ${50 + 40 * Math.cos(b)},${50 + 40 * Math.sin(b)} ${50 + 40 * Math.cos(c)},${50 + 40 * Math.sin(c)}`} />
          </g>
        );
      })}
    </svg>
  );
}
