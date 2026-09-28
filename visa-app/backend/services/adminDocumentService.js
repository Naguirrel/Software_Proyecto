function presentAdminDocument(document) {
  const {
    storage_key: storageKey,
    usuario_nombre: userName,
    usuario_correo: userEmail,
    ...safeDocument
  } = document;

  return {
    ...safeDocument,
    archivo_url: storageKey
      ? `/documentos/${document.id}/archivo`
      : safeDocument.archivo_url,
    usuario: {
      id: safeDocument.usuario_id,
      nombre: userName || "Usuario sin nombre",
      correo: userEmail || "",
    },
  };
}

function normalizeDocumentUpdatePayload(payload = {}) {
  const hasStatus = Object.prototype.hasOwnProperty.call(payload, "status");
  const hasFeedback = Object.prototype.hasOwnProperty.call(payload, "feedback");
  const normalizedStatus = payload.status === "rejected" ? "correction" : payload.status;
  const normalizedFeedback = hasFeedback
    ? String(payload.feedback || "").trim() || null
    : null;

  if (!hasStatus && !hasFeedback) {
    const error = new Error("Debe enviar estado u observaciones");
    error.statusCode = 400;
    throw error;
  }

  if (hasStatus && !["approved", "correction"].includes(normalizedStatus)) {
    const error = new Error("Estado de documento invalido");
    error.statusCode = 400;
    throw error;
  }

  return {
    hasStatus,
    hasFeedback,
    normalizedStatus,
    normalizedFeedback,
  };
}

function createAdminDocumentService(pool, { schemaReady = Promise.resolve() } = {}) {
  async function listDocuments({ advisorId } = {}) {
    await schemaReady;

    const values = [];
    const where = [];
    if (advisorId) {
      values.push(Number(advisorId));
      where.push(`t.id_asesor = $${values.length}`);
    }

    const result = await pool.query(`
      SELECT
        d.id,
        d.nombre,
        d.tipo,
        d.archivo_url,
        d.usuario_id,
        d.documento_key,
        d.estado,
        d.feedback,
        d.creado_en,
        d.actualizado_en,
        d.storage_key,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo,
        advisor.id_usuario AS asesor_id,
        advisor.nombre AS asesor_nombre
      FROM documentos d
      LEFT JOIN usuario u ON u.id_usuario = d.usuario_id
      LEFT JOIN tramite t ON t.id_usuario = d.usuario_id
      LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.actualizado_en DESC, d.creado_en DESC
    `, values);

    return result.rows.map(presentAdminDocument);
  }

  async function updateDocumentStatus(documentId, payload = {}, { advisorId } = {}) {
    await schemaReady;

    const updatePayload = normalizeDocumentUpdatePayload(payload);
    const updates = [];
    const values = [];

    if (updatePayload.hasStatus) {
      values.push(updatePayload.normalizedStatus);
      updates.push(`estado = $${values.length}`);
    }

    if (updatePayload.hasFeedback) {
      values.push(updatePayload.normalizedFeedback);
      updates.push(`feedback = $${values.length}`);
    }

    updates.push("actualizado_en = CURRENT_TIMESTAMP");
    values.push(documentId);
    const documentIdParam = values.length;
    if (advisorId) values.push(Number(advisorId));
    const advisorIdParam = advisorId ? values.length : null;

    const result = await pool.query(
      `
        WITH updated AS (
          UPDATE documentos
          SET ${updates.join(",\n              ")}
          WHERE id = $${documentIdParam}
            ${advisorId ? `AND EXISTS (
              SELECT 1 FROM tramite scoped_process
              WHERE scoped_process.id_usuario = documentos.usuario_id
                AND scoped_process.id_asesor = $${advisorIdParam}
            )` : ""}
          RETURNING id, nombre, tipo, archivo_url, usuario_id, documento_key, estado,
                    feedback, creado_en, actualizado_en, storage_key
        )
        SELECT
          updated.*,
          u.nombre AS usuario_nombre,
          u.correo AS usuario_correo,
          advisor.id_usuario AS asesor_id,
          advisor.nombre AS asesor_nombre
        FROM updated
        LEFT JOIN usuario u ON u.id_usuario = updated.usuario_id
        LEFT JOIN tramite t ON t.id_usuario = updated.usuario_id
        LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
      `,
      values
    );

    const document = result.rows[0];

    if (!document) {
      const error = new Error("Documento no encontrado");
      error.statusCode = 404;
      throw error;
    }

    return presentAdminDocument(document);
  }

  return { listDocuments, updateDocumentStatus };
}

module.exports = createAdminDocumentService;
