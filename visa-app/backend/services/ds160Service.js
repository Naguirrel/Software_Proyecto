function createDs160Service(pool, { activityLogService, notificacionService }) {

  async function getFormulario(userId) {
    const result = await pool.query(
      "SELECT * FROM formulario_ds160 WHERE id_usuario = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  async function saveFormulario(userId, correo, { datos, seccion_actual, completado }, req) {
    const existingForm = await pool.query(
      "SELECT id_formulario FROM formulario_ds160 WHERE id_usuario = $1",
      [userId]
    );

    let result;
    const isNewForm = existingForm.rows.length === 0;

    if (isNewForm) {
      result = await pool.query(
        `INSERT INTO formulario_ds160 (id_usuario, datos, seccion_actual, completado, updated_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [userId, JSON.stringify(datos || {}), seccion_actual || 1, completado || false]
      );
    } else {
      result = await pool.query(
        `UPDATE formulario_ds160 
         SET datos = $1, seccion_actual = $2, completado = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id_usuario = $4 
         RETURNING *`,
        [JSON.stringify(datos || {}), seccion_actual || 1, completado || false, userId]
      );
    }

    const formulario = result.rows[0];

    await activityLogService.logActivity({
      req,
      userId,
      userEmail: correo,
      role: "cliente",
      action: "ds160.saved",
      entityType: "formulario_ds160",
      entityId: formulario.id_formulario,
      description: isNewForm ? "Formulario DS-160 creado" : "Formulario DS-160 actualizado",
      metadata: {
        seccionActual: formulario.seccion_actual,
        completado: formulario.completado,
      },
    });

    return formulario;
  }

  async function avanzarTramitePago(userId) {
    const tramite = await pool.query(
      "SELECT id_tramite, progreso FROM tramite WHERE id_usuario = $1",
      [userId]
    );

    if (tramite.rows.length > 0 && tramite.rows[0].progreso < 34) {
      await pool.query(
        `UPDATE tramite
         SET etapa_actual = 'Pago de visa',
             progreso = 34,
             siguiente_paso = 'Realizar el pago de la tarifa de visa',
             mensaje = 'Formulario DS-160 completado. El siguiente paso es realizar el pago.'
         WHERE id_usuario = $1`,
        [userId]
      );
      return true;
    }
    return false;
  }

  async function notificarDs160Completado(userId) {
    try {
      await notificacionService.crear({
        userId,
        titulo: "DS-160 completado",
        mensaje: "Has completado el formulario DS-160 exitosamente. Ahora debes realizar el pago de la tarifa de visa.",
        tipo: "info",
        etapaRelacionada: "pago",
      });
    } catch (error) {
      console.error("Error al crear notificación DS-160:", error);
    }
  }

  async function logPdfExport(req, userId, correo, formularioId) {
    await activityLogService.logActivity({
      req,
      userId,
      userEmail: correo,
      role: "cliente",
      action: "ds160.pdf_exported",
      entityType: "formulario_ds160",
      entityId: formularioId,
      description: "PDF DS-160 descargado",
    });
  }

  return {
    getFormulario,
    saveFormulario,
    avanzarTramitePago,
    notificarDs160Completado,
    logPdfExport,
  };
}

module.exports = createDs160Service;