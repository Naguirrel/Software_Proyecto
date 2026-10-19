const { sendErrorResponse } = require("../middleware/errorResponse");

function createNotificacionController(notificacionService) {
  function handleError(res, error) {
    return sendErrorResponse(null, res, error, {
      fallback: "Error interno al procesar notificaciones",
      context: "notifications.request",
    });
  }

  async function listar(req, res) {
    try {
      const notificaciones = await notificacionService.listarPorUsuario(req.params.userId);
      return res.json({ notificaciones });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function listarDesdeBody(req, res) {
    try {
      const { userId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: "userId requerido en el body" });
      }
      const notificaciones = await notificacionService.listarPorUsuario(userId);
      return res.json({ notificaciones });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function contarNoLeidas(req, res) {
    try {
      const total = await notificacionService.contarNoLeidas(req.params.userId);
      return res.json({ total });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function contarNoLeidasDesdeBody(req, res) {
    try {
      const { userId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: "userId requerido en el body" });
      }
      const total = await notificacionService.contarNoLeidas(userId);
      return res.json({ total });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function marcarLeida(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId requerido en el body" });
      }
      const notificacion = await notificacionService.marcarLeida(req.params.id, userId);
      return res.json({ message: "Notificación marcada como leída", notificacion });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function marcarTodasLeidas(req, res) {
    try {
      const { userId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: "userId requerido en el body" });
      }
      const actualizadas = await notificacionService.marcarTodasLeidas(userId);
      return res.json({
        message: "Notificaciones marcadas como leídas",
        actualizadas,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function crear(req, res) {
    try {
      const { userId, titulo, mensaje, tipo, etapaRelacionada, prioridad } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId requerido" });
      }
      const notificacion = await notificacionService.crearNotificacion({
        userId,
        titulo,
        mensaje,
        tipo,
        etapaRelacionada,
        prioridad,
      });
      return res.status(201).json({
        message: "Notificación creada correctamente",
        notificacion,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function eliminar(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId requerido en el body" });
      }
      await notificacionService.eliminar(req.params.id, userId);
      return res.json({ message: "Notificación eliminada correctamente" });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return {
    listar,
    listarDesdeBody,
    contarNoLeidas,
    contarNoLeidasDesdeBody,
    marcarLeida,
    marcarTodasLeidas,
    crear,
    eliminar,
  };
}

module.exports = createNotificacionController;
