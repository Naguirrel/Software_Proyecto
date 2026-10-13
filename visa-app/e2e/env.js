const path = require("path");

const DB = {
  host: process.env.E2E_DB_HOST || "127.0.0.1",
  port: Number(process.env.E2E_DB_PORT || 5434),
  user: process.env.E2E_DB_USER || "postgres",
  password: process.env.E2E_DB_PASSWORD || "e2e",
  database: process.env.E2E_DB_NAME || "visa_e2e",
};

const API_PORT = Number(process.env.E2E_API_PORT || 3100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5174);

module.exports = {
  DB,
  API_PORT,
  WEB_PORT,
  API_URL: `http://localhost:${API_PORT}`,
  WEB_URL: `http://localhost:${WEB_PORT}`,
  UPLOAD_DIR: path.resolve(__dirname, ".tmp", "uploads"),
  WEB_DIST: path.resolve(__dirname, ".tmp", "web-dist"),
  // Usuarios de personal creados solo en la base E2E (nunca existen en desarrollo ni producción).
  ADMIN: { nombre: "Admin E2E", correo: "admin.e2e@visaguide.test", contrasena: "Admin-E2E-2026!", rol: "admin" },
  ADVISOR: { nombre: "Asesor E2E", correo: "asesor.e2e@visaguide.test", contrasena: "Asesor-E2E-2026!", rol: "asesor" },
};
