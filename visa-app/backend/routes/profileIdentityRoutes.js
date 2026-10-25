const express = require("express");
const { createProfileIdentityService } = require("../services/profileIdentityService");
const { sendErrorResponse } = require("../middleware/errorResponse");

module.exports = function createProfileIdentityRoutes(pool, {
  requireSession,
  schemaReady,
  upload,
  uploadStoredFile,
  deleteStoredFile,
  getStoredFile,
  activityLogService,
}) {
  const router = express.Router();
  const service = createProfileIdentityService(pool, {
    schemaReady,
    uploadStoredFile,
    deleteStoredFile,
    getStoredFile,
  });

  router.use(requireSession);

  router.get("/users/:id/avatar", async (req, res) => {
    try {
      const avatar = await service.getAvatar(req.auth, req.params.id);
      res.setHeader("Content-Type", avatar.contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      avatar.stream.on("error", (error) => {
        if (!res.headersSent) res.status(404).json({ error: "Fotografía no encontrada" });
        else res.destroy(error);
      });
      return avatar.stream.pipe(res);
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar la fotografía",
        context: "identity.avatar.read",
      });
    }
  });

  router.put("/avatar", upload.avatarSingle, async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await service.updateAvatar(req.auth.id_usuario, req.file, { baseUrl });
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: req.auth.id_usuario,
        role: req.auth.rol,
        action: "profile.avatar_updated",
        entityType: "usuario",
        entityId: req.auth.id_usuario,
        description: "Fotografía de perfil actualizada",
      });
      return res.json(result);
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible actualizar la fotografía",
        context: "identity.avatar.update",
      });
    }
  });

  router.delete("/avatar", async (req, res) => {
    try {
      const result = await service.deleteAvatar(req.auth.id_usuario);
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: req.auth.id_usuario,
        role: req.auth.rol,
        action: "profile.avatar_deleted",
        entityType: "usuario",
        entityId: req.auth.id_usuario,
        description: "Fotografía de perfil eliminada",
      });
      return res.json(result);
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible eliminar la fotografía",
        context: "identity.avatar.delete",
      });
    }
  });

  return router;
};
