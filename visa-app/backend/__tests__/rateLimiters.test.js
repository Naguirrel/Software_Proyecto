const express = require("express");
const request = require("supertest");
const { createRateLimiters, parsePositiveInteger, readRateLimitConfig } = require("../middleware/rateLimiters");
const { createRequestContext } = require("../middleware/requestContext");

const config = {
  api: { windowMs: 60_000, limit: 2 },
  login: { windowMs: 60_000, limit: 2 },
  register: { windowMs: 60_000, limit: 2 },
  recovery: { windowMs: 60_000, limit: 2 },
};

function createLimitedApp(limiter, routeHandler = (_req, res) => res.json({ ok: true })) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(createRequestContext());
  app.use(limiter);
  app.all("/resource", routeHandler);
  return app;
}

describe("rate limiting", () => {
  test("bloquea al exceder el límite y devuelve cabeceras estándar", async () => {
    const { api } = createRateLimiters({ config });
    const app = createLimitedApp(api);

    await request(app).get("/resource").expect(200);
    await request(app).get("/resource").expect(200);
    const response = await request(app).get("/resource").expect(429);

    expect(response.body).toMatchObject({
      code: "RATE_LIMITED",
      requestId: expect.any(String),
    });
    expect(response.headers.ratelimit).toBeDefined();
    expect(response.headers["retry-after"]).toBeDefined();
  });

  test("omite preflight OPTIONS y mantiene contadores independientes por IP", async () => {
    const { api } = createRateLimiters({ config });
    const app = createLimitedApp(api);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app).options("/resource").set("X-Forwarded-For", "203.0.113.10").expect(200);
    }
    await request(app).get("/resource").set("X-Forwarded-For", "203.0.113.10").expect(200);
    await request(app).get("/resource").set("X-Forwarded-For", "203.0.113.10").expect(200);
    await request(app).get("/resource").set("X-Forwarded-For", "203.0.113.10").expect(429);
    await request(app).get("/resource").set("X-Forwarded-For", "203.0.113.11").expect(200);
  });

  test("el límite de login descuenta respuestas exitosas y cuenta fallos", async () => {
    const { login } = createRateLimiters({ config });
    const app = createLimitedApp(login, (req, res) => {
      if (req.query.result === "success") return res.json({ ok: true });
      return res.status(401).json({ error: "Credenciales inválidas" });
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app).get("/resource?result=success").expect(200);
    }
    await request(app).get("/resource?result=failure").expect(401);
    await request(app).get("/resource?result=failure").expect(401);
    await request(app).get("/resource?result=failure").expect(429);
  });

  test("rechaza configuración ausente de enteros positivos", () => {
    expect(parsePositiveInteger(undefined, 10, "LIMIT")).toBe(10);
    expect(() => parsePositiveInteger("0", 10, "LIMIT")).toThrow("LIMIT debe ser un entero positivo");
    expect(() => parsePositiveInteger("1.5", 10, "LIMIT")).toThrow("LIMIT debe ser un entero positivo");
    expect(() => readRateLimitConfig({ RATE_LIMIT_API_MAX: "no-es-numero" })).toThrow(
      "RATE_LIMIT_API_MAX debe ser un entero positivo"
    );
  });
});
