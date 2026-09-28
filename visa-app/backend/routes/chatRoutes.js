const express = require("express");
const createAdvisorCommunicationService = require("../services/advisorCommunicationService");

module.exports = function createChatRoutes(pool, { requireSession }) {
  const router = express.Router();
  const service = createAdvisorCommunicationService(pool);
  router.use(requireSession);

  router.get("/", async (req, res) => {
    if (req.auth.rol !== "cliente") return res.status(403).json({ error: "Este chat corresponde a solicitantes" });
    try { return res.json(await service.getClientConversation(req.auth.id_usuario)); }
    catch (error) { return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "No fue posible cargar el chat" }); }
  });

  router.post("/messages", async (req, res) => {
    if (req.auth.rol !== "cliente") return res.status(403).json({ error: "Este chat corresponde a solicitantes" });
    try { return res.status(201).json({ message: await service.sendClientMessage(req.auth.id_usuario, req.body?.message) }); }
    catch (error) { return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "No fue posible enviar el mensaje" }); }
  });

  return router;
};
