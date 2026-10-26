const { sendErrorResponse } = require("../middleware/errorResponse");

function createPerfilController(perfilService, { activityLogService, notificacionService }) {

  async function guardarPerfil(req, res) {
    const { perfil } = req.body;

    if (!perfil) {
      return res.status(400).json({ error: "Perfil es obligatorio" });
    }

    try {
      const usuario = await perfilService.guardarPerfil(req.auth.id_usuario, perfil);

      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      await activityLogService.logActivity({
        req,
        actor: usuario,
        userId: usuario.id_usuario,
        userEmail: usuario.correo,
        role: usuario.rol || "cliente",
        action: "profile.selected",
        entityType: "usuario",
        entityId: usuario.id_usuario,
        description: "Perfil de visa guardado",
        metadata: { perfil },
      });

      const nextStage = await perfilService.avanzarTramiteDS160(usuario.id_usuario);

      // Notificar cambio de etapa
      try {
        await notificacionService.crearNotificacion({
          userId: usuario.id_usuario,
          titulo: "¡Perfil configurado!",
          mensaje: nextStage?.assigned
            ? "Tu perfil de visa ha sido guardado. El siguiente paso es completar el formulario DS-160."
            : "Tu perfil de visa ha sido guardado. Puedes cargar documentos mientras asignamos a tu asesor.",
          tipo: "info",
          etapaRelacionada: nextStage?.assigned ? "ds160" : "assignment",
        });
      } catch (notifError) {
        console.error("Error al crear notificación:", notifError);
      }

      res.json({
        message: "Perfil actualizado",
        perfil: usuario.perfil,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible guardar el perfil",
        context: "profile.save",
      });
    }
  }

  async function getVisaProfileRequirements(req, res) {
    try {
      return res.json(await perfilService.getProfileRequirements(req.auth.id_usuario));
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar los requisitos del perfil",
        context: "profile.requirements",
      });
    }
  }

  async function updateVisaDetails(req, res) {
    try {
      const result = await perfilService.updateVisaDetails(req.auth.id_usuario, req.body);
      await activityLogService.logActivity({
        req,
        userId: req.auth.id_usuario,
        role: "cliente",
        action: "visa_profile.details_updated",
        entityType: "usuario",
        entityId: req.auth.id_usuario,
        description: "Datos específicos del trámite actualizados",
        metadata: { fields: Object.keys(req.body || {}) },
      });
      return res.json(result);
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible actualizar los datos del trámite",
        context: "profile.details_update",
      });
    }
  }

  async function estadoTramite(req, res) {
    try {
      const usuario = await perfilService.findUserById(req.auth.id_usuario);

      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const hasProfile = Boolean(usuario.perfil);
      const tramite = await perfilService.getOrCreateTramite(usuario.id_usuario, hasProfile);

      res.json({
        estado: tramite.estado,
        etapaActual: tramite.etapa_actual,
        progreso: tramite.progreso,
        siguientePaso: tramite.siguiente_paso,
        mensaje: tramite.mensaje,
        created_at: tramite.created_at,
        updated_at: tramite.updated_at,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar el estado del trámite",
        context: "profile.process_status",
      });
    }
  }

  async function getUsuarioPerfil(req, res) {
    try {
      const usuario = await perfilService.findUserById(req.auth.id_usuario);

      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const tramiteResult = await perfilService.getTramiteByUserId(usuario.id_usuario);
      const tramite = tramiteResult || {
        estado: "En proceso",
        etapa_actual: "Formulario DS-160",
        progreso: 10,
      };

      const etapa = perfilService.calcularEtapa(tramite.progreso, usuario.perfil);

      res.json({
        usuario: {
          id: usuario.id_usuario,
          nombre: usuario.nombre,
          correo: usuario.correo,
          telefono: usuario.telefono || "",
          ciudad: usuario.ciudad || "",
          pais: usuario.pais || "",
          perfil: usuario.perfil || null,
          avatarVersion: usuario.avatar_updated_at ? new Date(usuario.avatar_updated_at).getTime() : null,
          preferencias: {
            notificacionesEmail: usuario.notificaciones_email !== false,
            idioma: usuario.idioma || "es",
          },
        },
        tramite: {
          tipoVisa: perfilService.PERFIL_A_VISA[usuario.perfil] || "Sin definir",
          consulado: [usuario.ciudad, usuario.pais].filter(Boolean).join(", ") || "Sin definir",
          estado: tramite.estado,
          etapaActual: tramite.etapa_actual,
          etapa,
          totalEtapas: 6,
          activo: tramite.estado === "En proceso",
        },
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar el perfil",
        context: "profile.read",
      });
    }
  }

  async function updateUsuarioPerfil(req, res) {
    const { nombre, telefono, ciudad, pais, notificacionesEmail, idioma } = req.body;

    try {
      const usuario = await perfilService.updateUsuarioPerfil(req.auth.id_usuario, {
        nombre,
        telefono,
        ciudad,
        pais,
        notificacionesEmail: notificacionesEmail !== undefined ? !notificacionesEmail : undefined,
        idioma,
      });

      if (!usuario) {
        return res.status(400).json({ error: "Nada que actualizar" });
      }

      await activityLogService.logActivity({
        req,
        actor: usuario,
        userId: usuario.id_usuario,
        userEmail: usuario.correo,
        role: "cliente",
        action: "profile.updated",
        entityType: "usuario",
        entityId: usuario.id_usuario,
        description: "Perfil de usuario actualizado",
        metadata: {
          campos: Object.keys({
            ...(nombre !== undefined ? { nombre: true } : {}),
            ...(telefono !== undefined ? { telefono: true } : {}),
            ...(ciudad !== undefined ? { ciudad: true } : {}),
            ...(pais !== undefined ? { pais: true } : {}),
            ...(notificacionesEmail !== undefined ? { notificacionesEmail: true } : {}),
            ...(idioma !== undefined ? { idioma: true } : {}),
          }),
        },
      });

      res.json({
        message: "Perfil actualizado correctamente",
        usuario: {
          id: usuario.id_usuario,
          nombre: usuario.nombre,
          correo: usuario.correo,
          telefono: usuario.telefono || "",
          ciudad: usuario.ciudad || "",
          pais: usuario.pais || "",
          perfil: usuario.perfil || null,
          avatarVersion: usuario.avatar_updated_at ? new Date(usuario.avatar_updated_at).getTime() : null,
          preferencias: {
            notificacionesEmail: usuario.notificaciones_email !== false,
            idioma: usuario.idioma || "es",
          },
        },
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible actualizar el perfil",
        context: "profile.update",
      });
    }
  }

  async function updateTramite(req, res) {
    return res.status(403).json({
      error: "La etapa del trámite se actualiza automáticamente al completar cada actividad",
    });
  }

  return {
    guardarPerfil,
    estadoTramite,
    getUsuarioPerfil,
    getVisaProfileRequirements,
    updateVisaDetails,
    updateUsuarioPerfil,
    updateTramite,
  };
}

module.exports = createPerfilController;
