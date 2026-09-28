const express = require("express");
const createDs160Controller = require("../controllers/ds160Controller");
const createDs160Service = require("../services/ds160Service");

function createDs160Routes(pool, { activityLogService, notificacionService, requireSession }) {
  const router = express.Router();

  const ds160Service = createDs160Service(pool, { activityLogService, notificacionService });
  const ds160Controller = createDs160Controller(ds160Service);

  // navigator.sendBeacon (usado para guardar el progreso al cerrar la pestaña)
  // no puede enviar encabezados personalizados, así que en ese caso el token
  // de sesión viaja en el body y lo promovemos a Authorization antes de validar.
  const authenticate = (req, res, next) => {
    if (!req.get("authorization") && req.body?.token) {
      req.headers.authorization = `Bearer ${req.body.token}`;
    }
    return requireSession(req, res, next);
  };

  router.post("/ds160/load", authenticate, ds160Controller.loadDs160);
  router.get("/ds160", (_req, res) => {
    res.status(405).json({ error: "Usa POST /ds160/load con tu sesión iniciada" });
  });

  router.post("/ds160", authenticate, ds160Controller.saveDs160);

  router.post("/ds160/pdf", authenticate, ds160Controller.exportPdf);
  router.get("/ds160/pdf", (_req, res) => {
    res.status(405).json({ error: "Usa POST /ds160/pdf con tu sesión iniciada" });
  });

  return router;
}

module.exports = createDs160Routes;
