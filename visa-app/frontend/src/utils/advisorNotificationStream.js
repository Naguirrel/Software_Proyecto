import { buildApiUrl } from "../config/api";
import { ApiError } from "./apiClient";
import { buildSessionHeaders } from "./sessionAuth";

export function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  let event = "message";
  let id = null;
  const data = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "id") id = value;
    else if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  const rawData = data.join("\n");
  let parsedData;
  try { parsedData = JSON.parse(rawData); } catch { parsedData = rawData; }
  return { event, id, data: parsedData };
}

export async function consumeAdvisorNotificationStream({ signal, onEvent, onOpen }) {
  const response = await fetch(buildApiUrl("/advisor/notifications/stream"), {
    method: "GET",
    headers: buildSessionHeaders({ Accept: "text/event-stream" }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("visaguide:session-expired"));
    throw new ApiError(
      response.status === 429
        ? "Hay demasiadas conexiones de notificaciones abiertas."
        : "No fue posible conectar las notificaciones en tiempo real.",
      { status: response.status, code: `HTTP_${response.status}` }
    );
  }
  if (!response.body) throw new ApiError("El navegador no permite recibir eventos en tiempo real.", { code: "STREAM_UNAVAILABLE" });

  onOpen?.();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (parsed) onEvent(parsed);
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!signal.aborted) throw new ApiError("La conexión de notificaciones se cerró.", { code: "STREAM_CLOSED" });
}
