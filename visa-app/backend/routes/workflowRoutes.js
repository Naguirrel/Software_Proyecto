const express = require("express");
const { createClientWorkflowService } = require("../services/clientWorkflowService");

function createWorkflowRoutes(pool, { requireSession, schemaReady = Promise.resolve() }) {
  const router = express.Router();
  const service = createClientWorkflowService(pool);

  router.use(requireSession);
  router.use(async (_req, res, next) => {
    try {
      await schemaReady;
      return next();
    } catch (error) {
      console.error("WORKFLOW SCHEMA ERROR:", error);
      return res.status(500).json({ error: "No fue posible preparar el flujo del trámite" });
    }
  });

  router.get("/me", async (req, res) => {
    if (req.auth.rol !== "cliente") {
      return res.status(403).json({ error: "El flujo corresponde a solicitantes" });
    }
    try {
      return res.json(await service.getWorkflow(req.auth.id_usuario));
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.statusCode ? error.message : "No fue posible cargar el flujo del trámite",
      });
    }
  });

  return router;
}

function createWorkflowStepMiddleware(pool, { schemaReady = Promise.resolve() } = {}) {
  const service = createClientWorkflowService(pool);
  return (step) => async (req, res, next) => {
    try {
      await schemaReady;
      if (req.auth?.rol !== "cliente") return next();
      req.clientWorkflow = await service.assertStep(req.auth.id_usuario, step);
      return next();
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) console.error("WORKFLOW GATE ERROR:", error);
      return res.status(error.statusCode || 500).json({
        error: error.statusCode ? error.message : "No fue posible validar la etapa del trámite",
        code: error.code,
        requiredStep: error.requiredStep,
        requiredPath: error.requiredPath,
      });
    }
  };
}

module.exports = { createWorkflowRoutes, createWorkflowStepMiddleware };
