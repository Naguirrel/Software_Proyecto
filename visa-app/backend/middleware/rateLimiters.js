const { rateLimit } = require("express-rate-limit");

const RATE_LIMIT_MESSAGES = Object.freeze({
  api: "Demasiadas solicitudes. Inténtalo nuevamente más tarde.",
  login: "Demasiados intentos de inicio de sesión. Espera antes de intentarlo nuevamente.",
  register: "Se alcanzó el límite temporal de registros. Inténtalo nuevamente más tarde.",
  recovery: "Demasiadas solicitudes de seguridad de cuenta. Espera antes de intentarlo nuevamente.",
});

const DEFAULT_RATE_LIMITS = Object.freeze({
  api: { windowMs: 15 * 60 * 1000, limit: 600 },
  login: { windowMs: 15 * 60 * 1000, limit: 10 },
  register: { windowMs: 60 * 60 * 1000, limit: 5 },
  recovery: { windowMs: 15 * 60 * 1000, limit: 8 },
});

function parsePositiveInteger(value, fallback, variableName) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} debe ser un entero positivo`);
  }
  return parsed;
}

function readRateLimitConfig(env = process.env) {
  const testLimit = env.NODE_ENV === "test" ? 100_000 : null;
  return {
    api: {
      windowMs: parsePositiveInteger(env.RATE_LIMIT_API_WINDOW_MS, DEFAULT_RATE_LIMITS.api.windowMs, "RATE_LIMIT_API_WINDOW_MS"),
      limit: parsePositiveInteger(env.RATE_LIMIT_API_MAX, testLimit || DEFAULT_RATE_LIMITS.api.limit, "RATE_LIMIT_API_MAX"),
    },
    login: {
      windowMs: parsePositiveInteger(env.RATE_LIMIT_LOGIN_WINDOW_MS, DEFAULT_RATE_LIMITS.login.windowMs, "RATE_LIMIT_LOGIN_WINDOW_MS"),
      limit: parsePositiveInteger(env.RATE_LIMIT_LOGIN_MAX, testLimit || DEFAULT_RATE_LIMITS.login.limit, "RATE_LIMIT_LOGIN_MAX"),
    },
    register: {
      windowMs: parsePositiveInteger(env.RATE_LIMIT_REGISTER_WINDOW_MS, DEFAULT_RATE_LIMITS.register.windowMs, "RATE_LIMIT_REGISTER_WINDOW_MS"),
      limit: parsePositiveInteger(env.RATE_LIMIT_REGISTER_MAX, testLimit || DEFAULT_RATE_LIMITS.register.limit, "RATE_LIMIT_REGISTER_MAX"),
    },
    recovery: {
      windowMs: parsePositiveInteger(env.RATE_LIMIT_RECOVERY_WINDOW_MS, DEFAULT_RATE_LIMITS.recovery.windowMs, "RATE_LIMIT_RECOVERY_WINDOW_MS"),
      limit: parsePositiveInteger(env.RATE_LIMIT_RECOVERY_MAX, testLimit || DEFAULT_RATE_LIMITS.recovery.limit, "RATE_LIMIT_RECOVERY_MAX"),
    },
  };
}

function createLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    skipSuccessfulRequests,
    handler: (req, res, _next, options) => res.status(options.statusCode).json({
      error: message,
      code: "RATE_LIMITED",
      requestId: req.requestId,
    }),
  });
}

function createRateLimiters({ env = process.env, config = readRateLimitConfig(env) } = {}) {
  return {
    api: createLimiter({ ...config.api, message: RATE_LIMIT_MESSAGES.api }),
    login: createLimiter({
      ...config.login,
      message: RATE_LIMIT_MESSAGES.login,
      skipSuccessfulRequests: true,
    }),
    register: createLimiter({ ...config.register, message: RATE_LIMIT_MESSAGES.register }),
    recovery: createLimiter({ ...config.recovery, message: RATE_LIMIT_MESSAGES.recovery }),
  };
}

module.exports = {
  DEFAULT_RATE_LIMITS,
  RATE_LIMIT_MESSAGES,
  createRateLimiters,
  parsePositiveInteger,
  readRateLimitConfig,
};
