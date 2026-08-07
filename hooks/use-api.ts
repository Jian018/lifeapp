"use client";

import { useCallback, useEffect, useState } from "react";

export type ApiState<T> = { data: T | null; loading: boolean; error: string | null; refetch: () => Promise<void> };

export function useApi<T>(url: string): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load data.");
      setData(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load data."); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => {
    let active = true;
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load data.");
        if (active) { setData(body); setError(null); }
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url]);
  return { data, loading, error, refetch: load };
}

export async function apiRequest<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.") as Error & { code?: string; status?: number };
    error.code = data.code; error.status = response.status; throw error;
  }
  return data as T;
}
