import { RefreshCw } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 ${className}`} aria-hidden />;
}

/** Placeholder cards shown while a list loads, so the page doesn't jump when data arrives. */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 flex-none rounded-lg" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
          </div>
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      ))}
    </div>
  );
}

/** A failed load with a way to try again, instead of a blank page. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center" role="alert">
      <div className="font-medium text-ink-900">We couldn't load this</div>
      <p className="max-w-md text-sm text-ink-600">{message}</p>
      <button className="btn-secondary btn-sm" onClick={onRetry}><RefreshCw size={15} /> Try again</button>
    </div>
  );
}
