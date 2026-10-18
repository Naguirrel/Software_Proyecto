const helmet = require("helmet");

const PERMISSIONS_POLICY = "camera=(), geolocation=(), microphone=(), payment=(), usb=()";

function createSecurityHeaders() {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  });

  return (req, res, next) => {
    res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
    return helmetMiddleware(req, res, next);
  };
}

function createApiDocsSecurityHeaders(env = process.env) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  });
}

module.exports = {
  PERMISSIONS_POLICY,
  createApiDocsSecurityHeaders,
  createSecurityHeaders,
};
