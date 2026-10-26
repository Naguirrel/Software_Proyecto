const express = require("express");
const createPerfilController = require("../controllers/perfilController");
const createFamilyGroupController = require("../controllers/familyGroupController");
const createPerfilService = require("../services/perfilService");
const { createFamilyGroupService } = require("../services/familyGroupService");

function createPerfilRoutes(pool, {
  userSchemaReady,
  tramiteSchemaReady,
  activityLogService,
  notificacionService,
  requireSession,
  visaProfileSchemaReady,
}) {
  const router = express.Router();

  const perfilService = createPerfilService(pool, { userSchemaReady, tramiteSchemaReady, visaProfileSchemaReady });
  const perfilController = createPerfilController(perfilService, { activityLogService, notificacionService });
  const familyGroupService = createFamilyGroupService(pool, { schemaReady: visaProfileSchemaReady });
  const familyGroupController = createFamilyGroupController(familyGroupService, { activityLogService });

  const requireClient = (req, res, next) => {
    if (req.auth?.rol !== "cliente") {
      return res.status(403).json({ error: "Acceso permitido únicamente a clientes" });
    }
    return next();
  };
  const clientOnly = [requireSession, requireClient];

  router.post("/guardar-perfil", ...clientOnly, perfilController.guardarPerfil);
  router.get("/visa-profile/requirements", ...clientOnly, perfilController.getVisaProfileRequirements);
  router.put("/visa-profile/details", ...clientOnly, perfilController.updateVisaDetails);
  router.get("/visa-profile/family-members", ...clientOnly, familyGroupController.list);
  router.post("/visa-profile/family-members", ...clientOnly, familyGroupController.create);
  router.put("/visa-profile/family-members/:id", ...clientOnly, familyGroupController.update);
  router.delete("/visa-profile/family-members/:id", ...clientOnly, familyGroupController.remove);

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
