function createInterviewSessionController(interviewSessionService, { notificacionService, activityLogService } = {}) {
  function scopeSessionPayload(req) {
    if (req.auth?.rol !== "cliente") return req.body.session;
    let parsed;
    try {
      parsed = typeof req.body.session === "string"
        ? JSON.parse(req.body.session)
        : { ...(req.body.session || {}) };
    } catch {
      const error = new Error("Formato de sesión inválido");
      error.statusCode = 400;
      throw error;
    }
    parsed.user = {
      id: req.auth.id_usuario,
      nombre: req.auth.nombre,
      correo: req.auth.correo,
    };
    return parsed;
  }

  function clientScope(req) {
    return req.auth?.rol === "cliente" ? { userId: req.auth.id_usuario } : {};
  }

  function handleError(res, error) {
    const status = error.statusCode || 500;
    const message =
      status === 500 ? "Error interno al procesar sesiones" : error.message;

    if (status === 500) {
      console.error("INTERVIEW SESSION ERROR:", error);
    }

    return res.status(status).json({ error: message });
  }

  async function createSession(req, res) {
    try {
      const session = await interviewSessionService.createSession(
        scopeSessionPayload(req),
        req.files || [],
        { baseUrl: `${req.protocol}://${req.get("host")}` }
      );
      await activityLogService?.logActivity({
        req,
        userId: session.user_id,
        userEmail: session.user_email,
        role: "cliente",
        action: "interview.session_created",
        entityType: "interview_session",
        entityId: session.id,
        description: "Sesión de entrevista registrada",
        metadata: {
          status: session.status,
          responses: Array.isArray(session.responses) ? session.responses.length : 0,
        },
      });

      return res.status(201).json({
        message: "Sesión de entrevista guardada correctamente",
        session,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function listSessions(req, res) {
    try {
      const sessions = await interviewSessionService.listSessions({
        status: req.query.status,
      });
      return res.json({ sessions });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function listUserSessions(req, res) {
    try {
      const sessions = await interviewSessionService.listUserSessions(
        req.auth?.rol === "cliente" ? req.auth.id_usuario : req.params.userId
      );
      return res.json({ sessions });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function listUserSessionsFromBody(req, res) {
    try {
      const { userId } = req.auth?.rol === "cliente"
        ? { userId: req.auth.id_usuario }
        : req.body || {};
      if (!userId) {
        return res.status(400).json({ error: "userId requerido en el body" });
      }
      const sessions = await interviewSessionService.listUserSessions(userId);
      return res.json({ sessions });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function getSession(req, res) {
    try {
      const session = await interviewSessionService.getSession(req.params.id, clientScope(req));
      return res.json({ session });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function getSessionFromBody(req, res) {
    try {
      const { sessionId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId requerido en el body" });
      }
      const session = await interviewSessionService.getSession(sessionId, clientScope(req));
      return res.json({ session });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function getSessionAudio(req, res) {
    try {
      const audio = await interviewSessionService.getSessionAudio(
        req.params.id,
        req.params.questionId,
        clientScope(req)
      );

      if (audio.redirectUrl) {
        return res.redirect(audio.redirectUrl);
      }

      const contentType =
        audio.response?.audio?.mimetype ||
        audio.storedFile.contentType ||
        "audio/webm";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${audio.filename}"`
      );

      if (audio.storedFile.contentLength) {
        res.setHeader("Content-Length", String(audio.storedFile.contentLength));
      }

      audio.storedFile.stream.on("error", (streamError) => {
        console.error("INTERVIEW AUDIO STREAM ERROR:", streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: "No se pudo cargar el audio" });
        } else {
          res.destroy(streamError);
        }
      });

      return audio.storedFile.stream.pipe(res);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async function updateFeedback(req, res) {
    try {
      const session = await interviewSessionService.updateFeedback(
        req.params.id,
        req.body
      );

      if (notificacionService && session?.user_id) {
        try {
          await notificacionService.crearNotificacion({
            userId: session.user_id,
            titulo: "Entrevista revisada",
            mensaje: "Ya puedes consultar la retroalimentacion de tu entrevista.",
            tipo: "entrevista",
            etapaRelacionada: `entrevista-${session.id}`,
          });
        } catch (notificationError) {
          console.error("ERROR INTERVIEW FEEDBACK NOTIFICATION:", notificationError);
        }
      }
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: session.user_id,
        adminId: req.auth?.id_usuario,
        userEmail: req.auth?.correo,
        role: req.auth?.rol || "admin",
        action: "interview.feedback_updated",
        entityType: "interview_session",
        entityId: session.id,
        description: "Retroalimentación de entrevista guardada por administrador",
        metadata: {
          rating: session.rating,
          userEmail: session.user_email,
        },
      });

      return res.json({
        message: "Retroalimentación guardada correctamente",
        session,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return {
    createSession,
    listSessions,
    listUserSessions,
    listUserSessionsFromBody,
    getSession,
    getSessionFromBody,
    getSessionAudio,
    updateFeedback,
  };
}

module.exports = createInterviewSessionController;
