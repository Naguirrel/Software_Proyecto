const { streamDs160Pdf } = require("../services/ds160PdfService");
const { sendErrorResponse } = require("../middleware/errorResponse");

function createDs160Controller(ds160Service) {

  async function loadDs160(req, res) {
    try {
      const formulario = await ds160Service.getFormulario(req.auth.id_usuario);

      if (!formulario) {
        return res.json({
          datos: {},
          seccion_actual: 1,
          completado: false,
        });
      }

      res.json({
        datos: formulario.datos,
        seccion_actual: formulario.seccion_actual,
        completado: formulario.completado,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar el formulario DS-160",
        context: "ds160.load",
      });
    }
  }

  async function saveDs160(req, res) {
    const { datos, seccion_actual, completado } = req.body;

    try {
      const formulario = await ds160Service.saveFormulario(
        req.auth.id_usuario,
        req.auth.correo,
        { datos, seccion_actual, completado },
        req
      );

      // Si se completó, avanzar trámite y notificar
      if (completado) {
        const avanzado = await ds160Service.avanzarTramitePago(req.auth.id_usuario);
        if (avanzado) {
          await ds160Service.notificarDs160Completado(req.auth.id_usuario);
        }
      }

      res.json({
        message: "Formulario guardado correctamente",
        formulario,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible guardar el formulario DS-160",
        context: "ds160.save",
      });
    }
  }

  async function exportPdf(req, res) {
    try {
      const formulario = await ds160Service.getFormulario(req.auth.id_usuario);

      if (!formulario) {
        return res.status(404).json({ error: "Formulario DS-160 no encontrado" });
      }

      await ds160Service.logPdfExport(req, req.auth.id_usuario, req.auth.correo, formulario.id_formulario);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="ds160-${req.auth.id_usuario}.pdf"`);
      res.setHeader("Cache-Control", "no-store");

      return streamDs160Pdf({
        usuario: { id_usuario: req.auth.id_usuario, correo: req.auth.correo },
        formulario,
      }, res);
    } catch (error) {
      if (res.headersSent) return res.end();
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible generar el PDF del formulario DS-160",
        context: "ds160.pdf",
      });
    }
  }

  return {
    loadDs160,
    saveDs160,
    exportPdf,
  };
}

module.exports = createDs160Controller;
