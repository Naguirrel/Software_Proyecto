const express = require("express");
const createQuestionBankController = require("../controllers/questionBankController");
const { createQuestionBankService } = require("../services/questionBankService");

function createQuestionBankRoutes(pool, {
  requireAdmin = (_req, _res, next) => next(),
  requireSession = (_req, _res, next) => next(),
  requireWorkflowStep = () => (_req, _res, next) => next(),
} = {}) {
  const router = express.Router();
  const service = createQuestionBankService(pool);
  const controller = createQuestionBankController(service);

  router.get("/", requireSession, requireWorkflowStep("interview"), controller.listQuestions);
  router.get("/random", requireSession, requireWorkflowStep("interview"), controller.listRandomQuestions);
  router.get("/admin", requireAdmin, controller.listAdminQuestions);
  router.post("/", requireAdmin, controller.createQuestion);
  router.put("/:id", requireAdmin, controller.updateQuestion);
  router.patch("/:id/status", requireAdmin, controller.setQuestionActive);
  router.delete("/:id", requireAdmin, controller.deleteQuestion);

  return router;
}

module.exports = createQuestionBankRoutes;
