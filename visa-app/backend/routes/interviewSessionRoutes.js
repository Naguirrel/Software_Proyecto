const express = require("express");
const upload = require("../upload");
const createInterviewSessionController = require("../controllers/interviewSessionController");
const createInterviewSessionService = require("../services/interviewSessionService");

function createInterviewSessionRoutes(pool, {
  requireAdmin = (_req, _res, next) => next(),
  requireSession = (_req, _res, next) => next(),
  requireWorkflowStep = () => (_req, _res, next) => next(),
  notificacionService,
  activityLogService,
} = {}) {
  const router = express.Router();
  const service = createInterviewSessionService(pool);
  const controller = createInterviewSessionController(service, { notificacionService, activityLogService });

  router.get("/", requireAdmin, controller.listSessions);
  router.post("/", requireSession, requireWorkflowStep("interview"), upload.any(), controller.createSession);
  router.post("/user", requireSession, requireWorkflowStep("interview"), controller.listUserSessionsFromBody);
  router.post("/detail", requireSession, requireWorkflowStep("interview"), controller.getSessionFromBody);
  router.get("/user/:userId", requireSession, requireWorkflowStep("interview"), controller.listUserSessions);
  router.get("/:id/audio/:questionId", requireSession, requireWorkflowStep("interview"), controller.getSessionAudio);
  router.get("/:id", requireSession, requireWorkflowStep("interview"), controller.getSession);
  router.put("/:id/feedback", requireAdmin, controller.updateFeedback);

  return router;
}

module.exports = createInterviewSessionRoutes;
