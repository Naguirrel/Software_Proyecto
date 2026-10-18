const { sendErrorResponse } = require("../middleware/errorResponse");

function createDocumentController(documentService) {
  function canAccessUser(req, usuarioId) {
    const role = req.auth?.rol || "cliente";
    return role === "admin" || role === "asesor" || Number(req.auth?.id_usuario) === Number(usuarioId);
  }

  function resolveUsuarioId(req, value, { source = "body" } = {}) {
    const hasExplicitValue = value !== undefined && value !== null && value !== "";
    const parsed = hasExplicitValue ? Number(value) : Number(req.auth?.id_usuario);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      const error = new Error(
        source === "params" || hasExplicitValue
          ? "usuario_id debe ser numérico"
          : "usuario_id requerido en el body y debe ser numérico"
      );
      error.statusCode = 400;
      throw error;
    }

    if (!canAccessUser(req, parsed)) {
      const error = new Error("No puedes acceder a documentos de otro usuario");
      error.statusCode = 403;
      throw error;
    }

    return parsed;
  }

  function ensureCanAccessDocument(req, document) {
    if (canAccessUser(req, document.usuario_id)) return;

    const error = new Error("No puedes acceder a documentos de otro usuario");
    error.statusCode = 403;
    throw error;
  }

  async function upload(req, res) {
    const { nombre, tipo, usuario_id, documento_key } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Archivo requerido" });
    }

    try {
      const scopedUsuarioId = resolveUsuarioId(req, usuario_id);
      const { documento, uploadedFile } = await documentService.saveDocumento(
        req.file,
        { 
          nombre: nombre?.trim() || req.file.originalname, 
          tipo: tipo?.trim() || req.file.mimetype || null, 
          usuario_id: scopedUsuarioId,
          documento_key 
        },
        req
      );

      res.json({
        message: "Archivo subido correctamente",
        archivo_url: documento.archivo_url,
        key: uploadedFile.key,
        documento,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No se pudo guardar el documento",
        context: "documents.upload",
      });
    }
  }

  async function createDocumento(req, res) {
    const { nombre, tipo, usuario_id, documento_key } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Archivo requerido" });
    }

    if (!nombre?.trim()) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

    try {
      const scopedUsuarioId = resolveUsuarioId(req, usuario_id);
      const { documento, uploadedFile } = await documentService.saveDocumento(
        req.file,
        { nombre, tipo, usuario_id: scopedUsuarioId, documento_key },
        req
      );

      res.status(201).json({
        message: "Documento guardado correctamente",
        archivo_url: documento.archivo_url,
        key: uploadedFile.key,
        documento,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No se pudo guardar el documento",
        context: "documents.create",
      });
    }
  }

  async function listDocumentos(req, res) {
    const usuarioIdValue = req.params.usuarioId ?? req.body?.usuario_id ?? req.body?.usuarioId;

    try {
      const usuarioId = resolveUsuarioId(req, usuarioIdValue, {
        source: req.params.usuarioId === undefined ? "body" : "params",
      });
      const documentos = await documentService.listDocumentos(usuarioId);
      return res.json(documentos);
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No se pudieron cargar los documentos",
        context: "documents.list",
      });
    }
  }

  async function deleteDocumento(req, res) {
    const documentIdValue = req.params.id ?? req.body?.documento_id ?? req.body?.documentId;
    const documentId = Number(documentIdValue);
    const usuarioId = Number(req.body?.usuario_id ?? req.body?.usuarioId);

    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: "documento_id debe ser numérico" });
    }

    if (Number.isNaN(usuarioId)) {
      return res.status(400).json({ error: "usuario_id requerido en el body y debe ser numérico" });
    }

    try {
      resolveUsuarioId(req, usuarioId);
      const deleted = await documentService.deleteDocumento(documentId, usuarioId);

      if (!deleted) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }

      return res.json({ message: "Documento eliminado correctamente" });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No se pudo eliminar el documento",
        context: "documents.delete",
      });
    }
  }

  async function getArchivo(req, res) {
    const documentId = Number(req.params.id);

    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: "documento_id debe ser numérico" });
    }

    try {
      const document = await documentService.getDocumentoById(documentId);

      if (!document) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }

      ensureCanAccessDocument(req, document);

      if (!document.storage_key) {
        if (documentService.isSelfDocumentFileUrl(document)) {
          return res.status(404).json({ error: "El archivo no está disponible para vista previa" });
        }
        return res.redirect(document.archivo_url);
      }

      const storedFile = await documentService.getDocumentoFile(document.storage_key);
      const contentType = documentService.inferDocumentContentType(document, storedFile);
      const dispositionType = documentService.canPreviewInline(contentType) ? "inline" : "attachment";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Link", '</visaguide-favicon.svg>; rel="icon"; type="image/svg+xml"');
      res.setHeader(
        "Content-Disposition",
        `${dispositionType}; filename="${documentService.buildDownloadFilename(document)}"`
      );

      if (storedFile.contentLength) {
        res.setHeader("Content-Length", String(storedFile.contentLength));
      }

      storedFile.stream.on("error", (error) => {
        if (!res.headersSent) {
          sendErrorResponse(req, res, error, {
            fallback: "No se pudo cargar el documento",
            context: "documents.stream",
          });
        } else {
          console.error("ERROR STREAM DOCUMENTO:", error);
          res.destroy(error);
        }
      });

      return storedFile.stream.pipe(res);
    } catch (error) {
      if (res.headersSent) return res.end();
      return sendErrorResponse(req, res, error, {
        fallback: "No se pudo cargar el documento",
        context: "documents.file",
      });
    }
  }

  return {
    upload,
    createDocumento,
    listDocumentos,
    deleteDocumento,
    getArchivo,
  };
}

module.exports = createDocumentController;
