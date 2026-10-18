const DEVELOPMENT_ORIGINS = Object.freeze([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const PRODUCTION_ORIGINS = Object.freeze([
  "http://visa-app.duckdns.org",
  "https://visa-app.duckdns.org",
]);

function normalizeOrigin(origin) {
  return origin.trim().replace(/\/+$/, "");
}

function parseConfiguredOrigins(value) {
  return (value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function getAllowedOrigins(env = process.env) {
  const configuredOrigins = parseConfiguredOrigins(env.CORS_ALLOWED_ORIGINS);

  if (configuredOrigins.length > 0) {
    return new Set(configuredOrigins);
  }

  const defaults = env.NODE_ENV === "production"
    ? PRODUCTION_ORIGINS
    : [...DEVELOPMENT_ORIGINS, ...PRODUCTION_ORIGINS];

  return new Set(defaults);
}

function createCorsOptions(env = process.env) {
  const allowedOrigins = getAllowedOrigins(env);

  return {
    origin(origin, callback) {
      // CORS is a browser policy. Server-to-server clients commonly omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}

module.exports = {
  DEVELOPMENT_ORIGINS,
  PRODUCTION_ORIGINS,
  createCorsOptions,
  getAllowedOrigins,
  normalizeOrigin,
  parseConfiguredOrigins,
};
