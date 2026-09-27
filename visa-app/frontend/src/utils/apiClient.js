import { buildApiUrl } from "../config/api";

const DEFAULT_TIMEOUT_MS = 15_000;

const STATUS_MESSAGES = Object.freeze({
  400: "La solicitud contiene datos inválidos.",
  401: "Tu sesión expiró. Inicia sesión nuevamente.",
  403: "No tienes permiso para realizar esta acción.",
  404: "No se encontró el recurso solicitado.",
  409: "La operación entra en conflicto con el estado actual.",
  413: "El archivo enviado supera el tamaño permitido.",
  422: "No fue posible validar la información enviada.",
  429: "Se realizaron demasiadas solicitudes. Intenta nuevamente más tarde.",
  500: "El servidor encontró un error. Intenta nuevamente.",
  502: "El servicio no está disponible temporalmente.",
  503: "El servicio no está disponible temporalmente.",
  504: "El servidor tardó demasiado en responder.",
});

export class ApiError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED", details = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function clearStoredSession() {
  if (!localStorage.getItem("visaguide_session")) return;
  localStorage.removeItem("visaguide_session");
  localStorage.removeItem("correoUsuario");
  localStorage.removeItem("perfilUsuario");
  window.dispatchEvent(new CustomEvent("visaguide:session-expired"));
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  }
}

function getResponseMessage(response, data, fallbackMessage) {
  return data?.error || data?.message || fallbackMessage || STATUS_MESSAGES[response.status]
    || "No fue posible completar la operación.";
}

export async function apiRequest(path, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    fallbackMessage,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(buildApiUrl(path), {
      ...fetchOptions,
      signal: controller.signal,
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401) clearStoredSession();
      throw new ApiError(getResponseMessage(response, data, fallbackMessage), {
        status: response.status,
        code: data?.code || `HTTP_${response.status}`,
        details: data?.details || null,
      });
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError" && !timedOut) throw error;
    if (timedOut) {
      throw new ApiError("La solicitud tardó demasiado. Verifica tu conexión e intenta nuevamente.", {
        code: "REQUEST_TIMEOUT",
        cause: error,
      });
    }
    throw new ApiError("No fue posible conectar con el servidor. Verifica tu conexión.", {
      code: "NETWORK_ERROR",
      cause: error,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getErrorMessage(error, fallback = "Ocurrió un error inesperado.") {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}
