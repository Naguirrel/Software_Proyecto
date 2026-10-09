import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../utils/apiClient";
import { buildSessionHeaders } from "../utils/sessionAuth";

const DEFAULT_POLL_INTERVAL_MS = 10_000;

export default function useClientWorkflow({ enabled = true, pollInterval = DEFAULT_POLL_INTERVAL_MS } = {}) {
  const [workflow, setWorkflow] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setWorkflow(null);
      setIsLoading(false);
      setError("");
      return undefined;
    }

    let active = true;
    let requestInFlight = false;
    const controllers = new Set();
    const load = async ({ initial = false } = {}) => {
      if (requestInFlight) return;
      requestInFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      if (initial) setIsLoading(true);
      try {
        const data = await apiRequest("/workflow/me", {
          signal: controller.signal,
          headers: buildSessionHeaders(),
        });
        if (!active) return;
        setWorkflow(data);
        setError("");
      } catch (requestError) {
        if (active && requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        requestInFlight = false;
        controllers.delete(controller);
        if (active) setIsLoading(false);
      }
    };

    load({ initial: true });
    const intervalId = pollInterval > 0
      ? window.setInterval(() => document.visibilityState !== "hidden" && load(), pollInterval)
      : null;
    const handleRefresh = () => load();
    window.addEventListener("visaguide:workflow-refresh", handleRefresh);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("visaguide:workflow-refresh", handleRefresh);
      controllers.forEach((controller) => controller.abort());
    };
  }, [enabled, pollInterval, revision]);

  return { workflow, isLoading, error, retry };
}
