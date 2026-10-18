const { sendErrorResponse } = require("./errorResponse");

function notFoundHandler(req, res) {
  res.status(404).json({ error: "Recurso no encontrado" });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  return sendErrorResponse(req, res, err, { context: "unhandled.request" });
}

module.exports = { notFoundHandler, errorHandler };
