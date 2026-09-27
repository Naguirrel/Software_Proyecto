import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../utils/apiClient";

export function getAdminToken() {
  try {
    return JSON.parse(localStorage.getItem("visaguide_session") || "null")?.token || "";
  } catch {
    return "";
  }
}

export async function adminRequest(path, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getAdminToken()}`,
      ...options.headers,
    },
    fallbackMessage: "No fue posible completar la operación.",
  });
}

export default function useAdminResource(path) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [settledRequest, setSettledRequest] = useState(null);
  const retry = useCallback(() => {
    setIsLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    adminRequest(path, { signal: controller.signal })
      .then((nextData) => { if (!controller.signal.aborted) { setData(nextData); setError(""); } })
      .catch((requestError) => {
        if (!controller.signal.aborted && requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) { setIsLoading(false); setSettledRequest({ path, revision }); }
      });
    return () => controller.abort();
  }, [path, revision]);

  const isCurrentRequest = settledRequest?.path === path && settledRequest?.revision === revision;
  return { data: isCurrentRequest ? data : null, setData, isLoading: isLoading || !isCurrentRequest, error: isCurrentRequest ? error : "", retry };
}
