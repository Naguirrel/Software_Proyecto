const app = require("./app");
const { stopNotificationBridge } = require("./services/notificationRealtime");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  process.exit(1);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Cierre controlado iniciado por ${signal}`);
  server.close(async () => {
    await stopNotificationBridge();
    process.exit(0);
  });
  const forcedExit = setTimeout(() => process.exit(1), 10_000);
  forcedExit.unref?.();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
