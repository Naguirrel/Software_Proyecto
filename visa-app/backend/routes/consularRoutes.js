const express = require("express");

function handleError(res, error) {
  if (!error.statusCode || error.statusCode >= 500) console.error("CONSULAR MODULE ERROR:", error);
  return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "No fue posible procesar la solicitud" });
}

function createConsularRoutes({ requireSession, requireStaff, requireWorkflowStep = () => (_req, _res, next) => next(), paymentService, appointmentService,
  schemaReady, upload, uploadStoredFile, deleteStoredFile }) {
  const router = express.Router();
  router.use(async (_req, res, next) => {
    try { await schemaReady; return next(); } catch (error) { return handleError(res, error); }
  });

  router.get("/payments/me", requireSession, requireWorkflowStep("payment"), async (req, res) => {
    try { return res.json(await paymentService.getSummary(req.auth.id_usuario)); }
    catch (error) { return handleError(res, error); }
  });
  router.post("/payments/bank-transfer", requireSession, requireWorkflowStep("payment"),
    upload.single("file"), upload.handleUploadError, async (req, res) => {
    let storedFile;
    try {
      if (req.file) storedFile = await uploadStoredFile(req.file, { baseUrl: `${req.protocol}://${req.get("host")}` });
      const payment = await paymentService.submitTransfer({ user: req.auth, reference: req.body?.reference,
        receiptUrl: storedFile?.url, receiptStorageKey: storedFile?.key });
      return res.status(201).json({ payment });
    } catch (error) {
      if (storedFile?.key) await deleteStoredFile(storedFile.key).catch(() => {});
      return handleError(res, error);
    }
  });
  router.get("/appointments/me", requireSession, requireWorkflowStep("appointment"), async (req, res) => {
    try { return res.json({ appointments: await appointmentService.listForUser(req.auth.id_usuario) }); }
    catch (error) { return handleError(res, error); }
  });

  router.get("/staff/consular-cases", requireStaff, async (req, res) => {
    try { return res.json({ cases: await paymentService.listCases(req.auth) }); }
    catch (error) { return handleError(res, error); }
  });
  router.post("/staff/consular-payments/:id/start", requireStaff, async (req, res) => {
    try { return res.json({ payment: await paymentService.startConsularProcessing({ staff: req.auth, paymentId: req.params.id }) }); }
    catch (error) { return handleError(res, error); }
  });
  router.post("/staff/consular-payments/:id/review-transfer", requireStaff, async (req, res) => {
    try { return res.json({ payment: await paymentService.reviewTransfer({ staff: req.auth,
      paymentId: req.params.id, approved: req.body?.approved === true, reason: req.body?.reason }) }); }
    catch (error) { return handleError(res, error); }
  });
  router.post("/staff/consular-payments/:id/receipt", requireStaff,
    upload.single("file"), upload.handleUploadError, async (req, res) => {
      let storedFile;
      try {
        if (req.file) storedFile = await uploadStoredFile(req.file, { baseUrl: `${req.protocol}://${req.get("host")}` });
        const payment = await paymentService.recordConsularPayment({
          staff: req.auth, paymentId: req.params.id, receiptNumber: req.body?.receiptNumber,
          receiptUrl: storedFile?.url, receiptStorageKey: storedFile?.key, notes: req.body?.notes,
        });
        return res.json({ payment });
      } catch (error) {
        if (storedFile?.key) await deleteStoredFile(storedFile.key).catch(() => {});
        return handleError(res, error);
      }
    });
  router.put("/staff/consular-cases/:userId/appointment", requireStaff, async (req, res) => {
    try {
      const appointment = await appointmentService.saveOfficialAppointment({ staff: req.auth,
        userId: req.params.userId, appointmentAt: req.body?.appointmentAt,
        confirmationCode: req.body?.confirmationCode, consulate: req.body?.consulate, notes: req.body?.notes });
      return res.json({ appointment });
    } catch (error) { return handleError(res, error); }
  });
  router.post("/staff/consular-cases/:userId/appointments/:id/cancel", requireStaff, async (req, res) => {
    try { return res.json({ appointment: await appointmentService.cancelByStaff({ staff: req.auth,
      userId: req.params.userId, appointmentId: req.params.id }) }); }
    catch (error) { return handleError(res, error); }
  });
  return router;
}

module.exports = createConsularRoutes;
