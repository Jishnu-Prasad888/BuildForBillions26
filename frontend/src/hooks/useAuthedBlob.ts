import { useEffect, useState } from "react";
import { api } from "@/services/api";

/* Loads an image/PDF that lives behind the authenticated API into an object URL (files are never publicly addressable). */
export function useAuthedBlobUrl(path: string | null, version = "") {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let made: string | null = null;
    setLoading(true);
    setError(null);
    api.blob(path).then((b) => {
      if (cancelled) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    }).catch((e) => !cancelled && setError(e.message)).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [path, version]);
  return { url, error, loading };
}

export async function downloadBlob(path: string, filename: string) {
  const blob = await api.blob(path);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
