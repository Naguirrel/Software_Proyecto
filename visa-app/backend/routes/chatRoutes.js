const express = require("express");
const createAdvisorCommunicationService = require("../services/advisorCommunicationService");
const { sendErrorResponse } = require("../middleware/errorResponse");

module.exports = function createChatRoutes(pool, { requireSession, notificacionService }) {
  const router = express.Router();
  const service = createAdvisorCommunicationService(pool, { notificacionService });
  router.use(requireSession);

  router.get("/", async (req, res) => {
    if (req.auth.rol !== "cliente") return res.status(403).json({ error: "Este chat corresponde a solicitantes" });
    try { return res.json(await service.getClientConversation(req.auth.id_usuario, req.query)); }
    catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar el chat",
        context: "chat.load",
      });
    }
  });

  router.post("/messages", async (req, res) => {
    if (req.auth.rol !== "cliente") return res.status(403).json({ error: "Este chat corresponde a solicitantes" });
    try { return res.status(201).json({ message: await service.sendClientMessage(req.auth.id_usuario, req.body?.message) }); }
    catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible enviar el mensaje",
        context: "chat.send",
      });
    }
  });

  return router;
};
