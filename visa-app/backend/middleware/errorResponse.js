const crypto = require("crypto");

const INTERNAL_ERROR_MESSAGE = "Ocurrió un error interno. Inténtalo nuevamente más tarde.";

function redactSensitiveText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/gi, "$1[REDACTED]@")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/\b(password|passwd|token|secret|authorization)\s*[=:]\s*([^\s,;]+)/gi, "$1=[REDACTED]");
}

function normalizeErrorStatus(error) {
  const statusCode = Number(error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
}

function getRequestId(req, res) {
  if (req?.requestId) return req.requestId;
  const responseRequestId = res?.getHeader?.("X-Request-Id");
  const requestId = typeof responseRequestId === "string" && responseRequestId
    ? responseRequestId
    : crypto.randomUUID();
  if (req) req.requestId = requestId;
  res?.setHeader?.("X-Request-Id", requestId);
  return requestId;
}

function logServerError(error, req, requestId, context) {
  console.error(JSON.stringify({
    event: "request.failed",
    requestId,
    context: context || "http.request",
    method: req?.method,
    path: req?.originalUrl || req?.url,
    error: {
      name: error?.name || "Error",
      message: redactSensitiveText(error?.message || "Unknown server error"),
      code: error?.code,
      stack: redactSensitiveText(error?.stack),
    },
  }));
}

function sendErrorResponse(req, res, error, {
  fallback = INTERNAL_ERROR_MESSAGE,
  context,
  clientDetails,
} = {}) {
  const activeRequest = req || res?.req;
  const statusCode = normalizeErrorStatus(error);
  if (statusCode < 500) {
    const message = typeof error?.message === "string" && error.message.trim()
      ? error.message
      : "Solicitud inválida";
    return res.status(statusCode).json({ error: message, ...(clientDetails || {}) });
  }

  const requestId = getRequestId(activeRequest, res);
  logServerError(error, activeRequest, requestId, context);
  return res.status(statusCode).json({
    error: fallback,
    code: "INTERNAL_ERROR",
    requestId,
  });
}

module.exports = {
  INTERNAL_ERROR_MESSAGE,
  getRequestId,
  logServerError,
  normalizeErrorStatus,
  redactSensitiveText,
  sendErrorResponse,
};
