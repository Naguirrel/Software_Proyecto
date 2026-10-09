const crypto = require("crypto");

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return "visaguide-development-session-secret";
  return null;
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function issueSessionToken(user) {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET is required in production");

  const payload = encode(JSON.stringify({
    sub: user.id_usuario,
    correo: user.correo,
    rol: user.rol || "cliente",
    exp: Date.now() + TOKEN_TTL_MS,
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function verifySessionToken(token) {
  const secret = getSecret();
  if (!secret || !token) return null;

  const segments = token.split(".");
  if (segments.length !== 2) return null;

  const [payload, signature] = segments;
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function getBearerToken(authorization) {
  if (typeof authorization !== "string") return "";

  const match = authorization.match(/^Bearer[ \t]+([^\s,]+)$/i);
  return match?.[1] || "";
}

function createSessionMiddleware(pool) {
  return async (req, res, next) => {
    const token = getBearerToken(req.get("authorization"));
    const session = verifySessionToken(token);

    if (!session) return res.status(401).json({ error: "Sesión inválida o expirada" });

    try {
      const result = await pool.query(
        `SELECT id_usuario, nombre, correo, perfil, COALESCE(rol, 'cliente') AS rol, activo, email_verificado, idioma
         FROM usuario WHERE id_usuario = $1`,
        [session.sub]
      );
      const user = result.rows[0];
      if (!user || user.activo === false) return res.status(401).json({ error: "Sesión inválida o expirada" });
      req.auth = user;
      return next();
    } catch (error) {
      console.error("AUTHORIZATION ERROR:", error);
      return res.status(500).json({ error: "No fue posible validar la autorización" });
    }
  };
}

function createRoleMiddleware(pool, allowedRoles) {
  const authenticate = createSessionMiddleware(pool);
  const roles = new Set(allowedRoles);
  return (req, res, next) => authenticate(req, res, () => {
    if (!roles.has(req.auth.rol)) return res.status(403).json({ error: "Acceso no autorizado" });
    return next();
  });
}

module.exports = { createRoleMiddleware, createSessionMiddleware, issueSessionToken, verifySessionToken };
