const express = require("express");
const request = require("supertest");
const { createRequestContext } = require("../middleware/requestContext");
const { createApiDocsSecurityHeaders, createSecurityHeaders, PERMISSIONS_POLICY } = require("../middleware/securityHeaders");
const { createApiDocsRouter } = require("../swagger");

function createTestApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(createRequestContext());
  app.use(createSecurityHeaders());
  app.use("/api-docs", createApiDocsSecurityHeaders({ NODE_ENV: "test" }));
  app.use(createApiDocsRouter());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/events", (_req, res) => {
    res.type("text/event-stream");
    res.send("event: ready\ndata: {}\n\n");
  });
  return app;
}

describe("cabeceras HTTP de seguridad", () => {
  test("protege las respuestas de la API sin imponer CSP a archivos o SSE", async () => {
    const response = await request(createTestApp()).get("/health").expect(200);

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["strict-transport-security"]).toContain("max-age=");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["permissions-policy"]).toBe(PERMISSIONS_POLICY);
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.headers["content-security-policy"]).toBeUndefined();
  });

  test("aplica una CSP compatible y restringida a Swagger UI", async () => {
    const response = await request(createTestApp()).get("/api-docs/").expect(200);
    const policy = response.headers["content-security-policy"];

    expect(response.text).toContain("VisaGuide API");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  test("mantiene compatible el tipo de contenido de eventos en tiempo real", async () => {
    const response = await request(createTestApp()).get("/events").expect(200);

    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.text).toContain("event: ready");
  });

  test("conserva identificadores válidos y reemplaza valores inseguros", async () => {
    const accepted = await request(createTestApp())
      .get("/health")
      .set("X-Request-Id", "frontend:request-42")
      .expect(200);
    const rejected = await request(createTestApp())
      .get("/health")
      .set("X-Request-Id", "valor con espacios y caracteres <script>")
      .expect(200);

    expect(accepted.headers["x-request-id"]).toBe("frontend:request-42");
    expect(rejected.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(rejected.headers["x-request-id"]).not.toContain("script");
  });
});
