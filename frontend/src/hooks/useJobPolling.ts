import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { IngestionJob } from "@/types";

/* Polls an ingestion job until it completes or fails. */
export function useJobPolling(jobId: string | null, onDone?: (j: IngestionJob) => void) {
  const [job, setJob] = useState<IngestionJob | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      const j = await api.get<IngestionJob>(`/api/admin/ingestion/${jobId}`);
      if (stop) return;
      setJob(j);
      if (j.status === "COMPLETE" || j.status === "FAILED") onDone?.(j);
      else setTimeout(tick, 700);
    };
    tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  return job;
}
