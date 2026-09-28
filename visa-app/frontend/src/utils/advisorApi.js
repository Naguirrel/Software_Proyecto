import { apiRequest } from "./apiClient";
import { buildSessionHeaders } from "./sessionAuth";

export function advisorRequest(path, options = {}) {
  const hasBody = options.body !== undefined;
  return apiRequest(`/advisor${path}`, {
    ...options,
    headers: buildSessionHeaders({
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    }),
  });
}
