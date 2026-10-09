const express = require("express");
const createAuthController = require("../controllers/authController");
const createAuthService = require("../services/authService");

function createAuthRoutes(pool, { userSchemaReady, tramiteSchemaReady, passwordResetSchemaReady, emailVerificationSchemaReady, loginSecuritySchemaReady, testUsersReady, requireSession, activityLogService, sendEmail }) {
  const router = express.Router();

  const authService = createAuthService(pool, { userSchemaReady, tramiteSchemaReady, passwordResetSchemaReady, emailVerificationSchemaReady, loginSecuritySchemaReady });
  const authController = createAuthController(authService, { activityLogService, testUsersReady, sendEmail });

  router.post("/register", authController.register);
  router.post("/login", authController.login);
  router.get("/validar-sesion", requireSession, authController.validateSession);
  router.post("/forgot-password", authController.forgotPassword);
  router.post("/reset-password", authController.resetPassword);
  router.post("/verificar-email", authController.verifyEmail);
  router.post("/reenviar-verificacion", authController.resendVerification);
  router.post("/desbloquear-cuenta", authController.unlockAccount);

  return router;
}

module.exports = createAuthRoutes;