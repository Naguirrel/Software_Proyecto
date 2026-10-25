const express = require("express");
const upload = require("../upload");
const createDocumentController = require("../controllers/documentController");
const createDocumentService = require("../services/documentService");

function createDocumentRoutes(pool, { documentSchemaReady, visaProfileSchemaReady, activityLogService, notificacionService, requireSession = (_req, _res, next) => next() }) {
  const router = express.Router();

  const documentService = createDocumentService(pool, { documentSchemaReady, visaProfileSchemaReady, activityLogService, notificacionService });
  const documentController = createDocumentController(documentService);

  router.post("/upload", requireSession, upload.single("file"), documentController.upload);
  router.post("/documentos", requireSession, upload.single("file"), documentController.createDocumento);
  router.post("/documentos/listar", requireSession, documentController.listDocumentos);
  
  // IMPORTANTE: /archivo debe ir ANTES de /:usuarioId
  router.get("/documentos/:id/archivo", requireSession, documentController.getArchivo);
  router.get("/documentos/:usuarioId", requireSession, documentController.listDocumentos);
  
  router.delete("/documentos", requireSession, documentController.deleteDocumento);
  router.delete("/documentos/:id", requireSession, documentController.deleteDocumento);

  return router;
}

module.exports = createDocumentRoutes;
