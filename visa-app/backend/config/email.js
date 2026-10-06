const nodemailer = require("nodemailer");

/**
 * Configuración de email con soporte para múltiples proveedores
 * 
 * Proveedores soportados:
 * - smtp: Cualquier servidor SMTP (Mailtrap, Gmail, etc.)
 * - resend: Resend.com (recomendado para producción)
 * - sendgrid: SendGrid
 */

function createEmailTransporter(env = process.env) {
  const provider = (env.EMAIL_PROVIDER || "smtp").toLowerCase();

  // Resend (recomendado para producción)
  if (provider === "resend") {
    if (!env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY no configurada, emails en modo dry-run");
      return null;
    }
    
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: {
        user: "resend",
        pass: env.RESEND_API_KEY,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // SMTP genérico (Mailtrap, Gmail, etc.)
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("Configuración SMTP incompleta, emails en modo dry-run");
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT, 10) || 587,
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function getEmailFrom(env = process.env) {
  if (env.EMAIL_FROM) return env.EMAIL_FROM;
  if (env.SMTP_FROM) return env.SMTP_FROM;
  if (env.SMTP_USER) return env.SMTP_USER;
  return "VisaGuide <noreply@visaguide.com>";
}

function getEmailConfig(env = process.env) {
  return {
    provider: (env.EMAIL_PROVIDER || "smtp").toLowerCase(),
    from: getEmailFrom(env),
    frontendUrl: env.FRONTEND_URL || "http://localhost:5173",
  };
}

module.exports = {
  createEmailTransporter,
  getEmailFrom,
  getEmailConfig,
};