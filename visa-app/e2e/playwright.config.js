const { defineConfig, devices } = require("@playwright/test");
const { DB, API_PORT, WEB_PORT, API_URL, WEB_URL, UPLOAD_DIR, WEB_DIST } = require("./env");

const isCI = Boolean(process.env.CI);

// Variables del backend para el E2E. Se fijan vacías las de correo para que nunca se
// envíe un correo real (el servicio cae en modo simulado).
const backendEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: String(API_PORT),
  DB_HOST: DB.host,
  DB_PORT: String(DB.port),
  DB_USER: DB.user,
  DB_PASSWORD: DB.password,
  DB_NAME: DB.database,
  SESSION_SECRET: "e2e-session-secret-not-for-production",
  LOCAL_UPLOAD_DIR: UPLOAD_DIR,
  CORS_ALLOWED_ORIGINS: WEB_URL,
  FRONTEND_URL: WEB_URL,
  EMAIL_REMINDERS_MODE: "disabled",
  RESEND_API_KEY: "",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASS: "",
};

module.exports = defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.js",
  // El flujo del cliente es una sola historia en orden: no se paraleliza.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    locale: "es-GT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    permissions: ["microphone"],
    launchOptions: {
      // Micrófono simulado para el simulador de entrevista.
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node index.js",
      cwd: "../backend",
      url: `${API_URL}/questions`,
      env: backendEnv,
      reuseExistingServer: !isCI,
      timeout: 90_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // Se prueba la versión compilada (como producción), no el servidor de desarrollo:
      // Vite en modo dev recarga la página completa al descubrir dependencias nuevas y eso
      // hacía fallar los pasos de forma intermitente. La compilación va a una carpeta propia
      // para no tocar `frontend/dist`.
      command: `npx vite build --outDir ${WEB_DIST} --emptyOutDir && npx vite preview --outDir ${WEB_DIST} --host localhost --port ${WEB_PORT} --strictPort`,
      cwd: "../frontend",
      url: WEB_URL,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: !isCI,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
