const express = require("express");
const request = require("supertest");
const { createApiDocsRouter } = require("../swagger");

describe("documentación de la API", () => {
  const app = express();
  app.use(createApiDocsRouter());

  test("expone el contrato OpenAPI", async () => {
    const response = await request(app).get("/api-docs.json").expect(200);

    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.paths["/login"].post).toBeDefined();
    expect(response.body.paths["/validar-sesion"].get.security).toEqual([{ bearerAuth: [] }]);
  });

  test("sirve Swagger UI", async () => {
    const response = await request(app).get("/api-docs/").expect(200);

    expect(response.text).toContain("VisaGuide API");
  });
});
