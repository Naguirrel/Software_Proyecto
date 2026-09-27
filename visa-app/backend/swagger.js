const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openApiDocument = require("./docs/openapi");

function createApiDocsRouter() {
  const router = express.Router();

  router.get("/api-docs.json", (_req, res) => res.json(openApiDocument));
  router.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "VisaGuide API",
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  return router;
}

module.exports = { createApiDocsRouter, openApiDocument };
