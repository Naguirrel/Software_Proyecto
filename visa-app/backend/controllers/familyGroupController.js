const { sendErrorResponse } = require("../middleware/errorResponse");

function createFamilyGroupController(service, { activityLogService }) {
  const handleError = (req, res, error, fallback, context) => sendErrorResponse(req, res, error, {
    fallback,
    context,
  });

  async function list(req, res) {
    try {
      return res.json({ members: await service.listMembers(req.auth.id_usuario) });
    } catch (error) {
      return handleError(req, res, error, "No fue posible cargar el grupo familiar", "family_group.list");
    }
  }

  async function create(req, res) {
    try {
      const member = await service.createMember(req.auth.id_usuario, req.body);
      await activityLogService.logActivity({
        req,
        userId: req.auth.id_usuario,
        role: "cliente",
        action: "family_member.created",
        entityType: "family_group_member",
        entityId: member.id,
        description: "Integrante agregado al expediente familiar",
        metadata: { relationship: member.relationship },
      });
      return res.status(201).json({ member });
    } catch (error) {
      return handleError(req, res, error, "No fue posible agregar el integrante", "family_group.create");
    }
  }

  async function update(req, res) {
    try {
      const member = await service.updateMember(req.auth.id_usuario, req.params.id, req.body);
      await activityLogService.logActivity({
        req,
        userId: req.auth.id_usuario,
        role: "cliente",
        action: "family_member.updated",
        entityType: "family_group_member",
        entityId: member.id,
        description: "Integrante del expediente familiar actualizado",
        metadata: { fields: Object.keys(req.body || {}) },
      });
      return res.json({ member });
    } catch (error) {
      return handleError(req, res, error, "No fue posible actualizar el integrante", "family_group.update");
    }
  }

  async function remove(req, res) {
    try {
      const removed = await service.deleteMember(req.auth.id_usuario, req.params.id);
      await activityLogService.logActivity({
        req,
        userId: req.auth.id_usuario,
        role: "cliente",
        action: "family_member.deleted",
        entityType: "family_group_member",
        entityId: removed.id,
        description: "Integrante eliminado del expediente familiar",
      });
      return res.json({ message: "Integrante eliminado", id: removed.id });
    } catch (error) {
      return handleError(req, res, error, "No fue posible eliminar el integrante", "family_group.delete");
    }
  }

  return { create, list, remove, update };
}

module.exports = createFamilyGroupController;
