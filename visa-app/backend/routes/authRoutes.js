const express = require("express");
const createAuthController = require("../controllers/authController");
const createAuthService = require("../services/authService");

function createAuthRoutes(pool, {
  userSchemaReady,
  tramiteSchemaReady,
  passwordResetSchemaReady,
  emailVerificationSchemaReady,
  loginSecuritySchemaReady,
  testUsersReady,
  requireSession,
  activityLogService,
  sendEmail,
  loginLimiter = (_req, _res, next) => next(),
  registerLimiter = (_req, _res, next) => next(),
  recoveryLimiter = (_req, _res, next) => next(),
}) {
  const router = express.Router();

  const authService = createAuthService(pool, { userSchemaReady, tramiteSchemaReady, passwordResetSchemaReady, emailVerificationSchemaReady, loginSecuritySchemaReady });
  const authController = createAuthController(authService, { activityLogService, testUsersReady, sendEmail });

  router.post("/register", registerLimiter, authController.register);
  router.post("/login", loginLimiter, authController.login);
  router.get("/validar-sesion", requireSession, authController.validateSession);
  router.post("/forgot-password", recoveryLimiter, authController.forgotPassword);
  router.post("/reset-password", recoveryLimiter, authController.resetPassword);
  router.post("/verificar-email", recoveryLimiter, authController.verifyEmail);
  router.post("/reenviar-verificacion", recoveryLimiter, authController.resendVerification);
  router.post("/desbloquear-cuenta", recoveryLimiter, authController.unlockAccount);

  return router;
}

module.exports = createAuthRoutes;
