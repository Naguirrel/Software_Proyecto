const path = require("path");
const { uploadStoredFile, deleteStoredFile, getStoredFile } = require("../storage");

function buildStoredDocumentUrl(documentId) {
  return `/documentos/${documentId}/archivo`;
}

function buildDownloadFilename(document) {
  const rawName = document.nombre || `documento-${document.id}`;
  const sanitizedName = path.basename(rawName).replace(/["\r\n]/g, "").trim();
  return sanitizedName || `documento-${document.id}`;
}

function inferDocumentContentType(document, storedFile = {}) {
  if (document.tipo?.includes("/")) return document.tipo;
  if (storedFile.contentType && storedFile.contentType !== "application/octet-stream") {
    return storedFile.contentType;
  }

  const candidates = [
    document.nombre,
    document.archivo_url,
    document.storage_key,
  ].filter(Boolean);

  const extension = candidates
    .map((value) => path.extname(String(value)).toLowerCase())
    .find(Boolean);

  const mimeTypes = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  return mimeTypes[extension] || storedFile.contentType || "application/octet-stream";
}

function canPreviewInline(contentType) {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

function getUrlPathname(url) {
  try {
    return new URL(url, "http://visaguide.local").pathname;
  } catch {
    return "";
  }
}

function isSelfDocumentFileUrl(document) {
  return getUrlPathname(document.archivo_url) === buildStoredDocumentUrl(document.id);
}

function presentDocumento(row) {
  const storage_key = row.storage_key;
  const estado = row.estado === "rejected" ? "correction" : row.estado;

  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    archivo_url: storage_key ? buildStoredDocumentUrl(row.id) : row.archivo_url,
    usuario_id: row.usuario_id,
    documento_key: row.documento_key,
    estado,
    feedback: row.feedback,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  };
}

function createDocumentService(pool, { documentSchemaReady, activityLogService, notificacionService }) {

  async function insertDocumento({ nombre, tipo, archivoUrl, usuarioId, documentoKey, storageKey }) {
    await documentSchemaReady;

    let existingDocument = null;

    if (usuarioId && documentoKey) {
      const existing = await pool.query(
        `SELECT id, storage_key FROM documentos WHERE usuario_id = $1 AND documento_key = $2 LIMIT 1`,
        [usuarioId, documentoKey]
      );
      existingDocument = existing.rows[0] || null;
    }

    if (existingDocument) {
      const result = await pool.query(
        `UPDATE documentos
         SET nombre = $1, tipo = $2, archivo_url = $3, storage_key = $4,
             estado = 'review', feedback = NULL, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [nombre, tipo, archivoUrl, storageKey, existingDocument.id]
      );

      if (existingDocument.storage_key && existingDocument.storage_key !== storageKey) {
        deleteStoredFile(existingDocument.storage_key).catch((err) => {
          console.error("UPLOAD CLEANUP ERROR:", err);
        });
      }

      return result.rows[0];
    }

    const result = await pool.query(
      `INSERT INTO documentos (nombre, tipo, archivo_url, usuario_id, documento_key, estado, storage_key, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, 'review', $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [nombre, tipo, archivoUrl, usuarioId || null, documentoKey || null, storageKey || null]
    );

    return result.rows[0];
  }

  async function saveDocumento(file, { nombre, tipo, usuario_id, documento_key }, req) {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const parsedUsuarioId =
      usuario_id === undefined || usuario_id === null || usuario_id === ""
        ? null
        : Number(usuario_id);

    if (parsedUsuarioId !== null && Number.isNaN(parsedUsuarioId)) {
      const error = new Error("usuario_id debe ser numérico");
      error.statusCode = 400;
      throw error;
    }

    const uploadedFile = await uploadStoredFile(file, { baseUrl });

    try {
      const documento = await insertDocumento({
        nombre: nombre?.trim() || file.originalname,
        tipo: tipo?.trim() || file.mimetype || null,
        archivoUrl: uploadedFile.url,
        usuarioId: parsedUsuarioId,
        documentoKey: documento_key?.trim() || null,
        storageKey: uploadedFile.key,
      });

      await activityLogService.logActivity({
        req,
        userId: documento.usuario_id,
        userEmail: null,
        role: "cliente",
        action: "document.uploaded",
        entityType: "documento",
        entityId: documento.id,
        description: "Documento cargado",
        metadata: {
          nombre: documento.nombre,
          tipo: documento.tipo,
          documentoKey: documento.documento_key,
        },
      });

      try {
        await notificacionService?.notificarAsesorDeCliente(documento.usuario_id, {
          titulo: "Documento listo para revisión",
          mensaje: "{clientName} cargó el documento: " + documento.nombre,
          tipo: "documento",
          etapaRelacionada: documento.documento_key || `documento-${documento.id}`,
          actionUrl: `/advisor/documentos?document=${documento.id}`,
          entityType: "documento",
          entityId: documento.id,
          dedupeKey: `document:${documento.id}:uploaded`,
        });
      } catch (notificationError) {
        console.error("ADVISOR DOCUMENT NOTIFICATION ERROR:", notificationError);
      }

      return { documento: presentDocumento(documento), uploadedFile };
    } catch (error) {
      try {
        await deleteStoredFile(uploadedFile.key);
      } catch (cleanupError) {
        console.error("UPLOAD ERROR: cleanup failed", cleanupError);
      }
      throw error;
    }
  }

  async function listDocumentos(usuarioId) {
    await documentSchemaReady;
    const result = await pool.query(
      `SELECT id, nombre, tipo, archivo_url, usuario_id, documento_key, estado, feedback, creado_en, actualizado_en, storage_key
       FROM documentos WHERE usuario_id = $1
       ORDER BY actualizado_en DESC, creado_en DESC`,
      [usuarioId]
    );
    return result.rows.map(presentDocumento);
  }

  async function deleteDocumento(documentId, usuarioId) {
    await documentSchemaReady;
    const result = await pool.query(
      `DELETE FROM documentos WHERE id = $1 AND usuario_id = $2 RETURNING id, storage_key`,
      [documentId, usuarioId]
    );

    if (result.rows.length === 0) return null;

    const deleted = result.rows[0];
    if (deleted.storage_key) {
      deleteStoredFile(deleted.storage_key).catch((err) => {
        console.error("DELETE DOCUMENT CLEANUP ERROR:", err);
      });
    }

    return deleted;
  }

  async function getDocumentoById(documentId) {
    await documentSchemaReady;
    const result = await pool.query(
      "SELECT * FROM documentos WHERE id = $1",
      [documentId]
    );
    return result.rows[0] || null;
  }

  async function getDocumentoFile(storageKey) {
    return getStoredFile(storageKey);
  }

  return {
    presentDocumento,
    buildDownloadFilename,
    inferDocumentContentType,
    canPreviewInline,
    isSelfDocumentFileUrl,
    insertDocumento,
    saveDocumento,
    listDocumentos,
    deleteDocumento,
    getDocumentoById,
    getDocumentoFile,
  };
}

module.exports = createDocumentService;
