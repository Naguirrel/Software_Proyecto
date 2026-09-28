const nodemailer = require("nodemailer");

function createEmailTransporter(env = process.env) {
  // Si no hay configuración SMTP, retorna null
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
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
  return env.SMTP_FROM || env.SMTP_USER || "noreply@visaguide.com";
}

module.exports = {
  createEmailTransporter,
  getEmailFrom,
};