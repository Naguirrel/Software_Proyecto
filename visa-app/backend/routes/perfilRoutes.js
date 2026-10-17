const express = require("express");
const createPerfilController = require("../controllers/perfilController");
const createPerfilService = require("../services/perfilService");

function createPerfilRoutes(pool, {
  userSchemaReady,
  tramiteSchemaReady,
  activityLogService,
  notificacionService,
  requireSession,
}) {
  const router = express.Router();

  const perfilService = createPerfilService(pool, { userSchemaReady, tramiteSchemaReady });
  const perfilController = createPerfilController(perfilService, { activityLogService, notificacionService });

  const requireClient = (req, res, next) => {
    if (req.auth?.rol !== "cliente") {
      return res.status(403).json({ error: "Acceso permitido únicamente a clientes" });
    }
    return next();
  };
  const clientOnly = [requireSession, requireClient];

  router.post("/guardar-perfil", ...clientOnly, perfilController.guardarPerfil);

  router.post("/estado-tramite", ...clientOnly, perfilController.estadoTramite);
  router.get("/estado-tramite", ...clientOnly, (_req, res) => {
    res.status(405).json({ error: "Usa POST /estado-tramite" });
  });

  router.post("/usuario-perfil", ...clientOnly, perfilController.getUsuarioPerfil);
  router.get("/usuario-perfil", ...clientOnly, (_req, res) => {
    res.status(405).json({ error: "Usa POST /usuario-perfil" });
  });
  router.put("/usuario-perfil", ...clientOnly, perfilController.updateUsuarioPerfil);

  router.put("/tramite", ...clientOnly, perfilController.updateTramite);

  return router;
}

module.exports = createPerfilRoutes;
