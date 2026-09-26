import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import type { Application, SchemeCard } from "@/types";

/**
 * Starts (or resumes, the API returns the open one) an application for a scheme, then goes to it.
 * Guided forms open with the assistant's start dialog showing when `assist` is true.
 */
export function useStartApplication() {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (scheme: SchemeCard, assist: boolean) => {
    setBusy(scheme.code);
    setError(null);
    try {
      const app = await api.post<Application>("/api/applications", { scheme_code: scheme.code });
      nav(scheme.form_id ? `/applications/${app.id}/form${assist ? "?assist=1" : ""}` : `/applications/${app.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  return { start, busy, error };
}
