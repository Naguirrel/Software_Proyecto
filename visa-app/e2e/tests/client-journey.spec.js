const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");
const { StaffApi } = require("../helpers/staffApi");
const { completeDs160 } = require("../helpers/ds160");
const { API_URL } = require("../env");

const fixture = (name) => path.join(__dirname, "..", "fixtures", name);

// Recorrido completo de un cliente nuevo: registro → perfil → DS-160 → documentos →
// pago → cita → entrevista. Es una sola historia en orden, por eso va en serie y
// cada paso depende del anterior. Los pasos que solo puede hacer el personal
// (asignar asesor, aprobar documentos, confirmar pagos, registrar la cita) se hacen
// por la API real del backend con las cuentas del administrador y del asesor.
test.describe.serial("recorrido completo del cliente", () => {
  const suffix = Date.now();
  const client = {
    nombre: "Camila Prueba E2E",
    correo: `camila.${suffix}@visaguide.test`,
    contrasena: "Clave-E2E-2026!",
  };
  let staff;
  let clientId;

  test.beforeAll(async () => {
    staff = await StaffApi.create();
  });

  test.afterAll(async () => {
    await staff?.dispose();
  });

  test("se registra con una cuenta nueva y llega a la selección de perfil", async ({ page }) => {
    await page.goto("/registro");

    await page.getByLabel("Nombre completo").fill(client.nombre);
    await page.getByLabel("Correo electrónico").fill(client.correo);
    await page.locator("#registro-contrasena").fill(client.contrasena);
    await page.locator("#registro-confirmacion").fill(client.contrasena);
    await page.getByRole("button", { name: /Crear cuenta/ }).click();

    await expect(page).toHaveURL(/\/seleccion-perfil/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    clientId = (await staff.loginClient(client)).id;
  });

  test("elige su perfil de visa y llega al dashboard con el aviso de correo sin verificar", async ({ page }) => {
    await login(page, client);
    await page.goto("/seleccion-perfil");

    await page.getByRole("button", { name: /Turismo \/ Negocios \(B1\/B2\)/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "¡Hola, Camila!" })).toBeVisible();
    await expect(page.locator(".vg-email-verify-notice--banner")).toContainText("Verifica tu correo electrónico");
  });

  test("sin asesor asignado el DS-160 está bloqueado", async ({ page }) => {
    await login(page, client);
    await page.goto("/ds160");

    await expect(page.getByText("ETAPA BLOQUEADA")).toBeVisible();
    await expect(page.getByText("Necesitas un asesor asignado antes de iniciar el DS-160.")).toBeVisible();
    await expect(page.getByText("Sección 1:")).toHaveCount(0);
  });

  test("con asesor asignado completa el formulario DS-160 de las 10 secciones", async ({ page }) => {
    await staff.assignAdvisor(client.correo);
    await login(page, client);
    await page.goto("/ds160");

    await completeDs160(page);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    // El DS-160 quedó guardado como completado en el backend.
    const { token } = await staff.loginClient(client);
    const saved = await page.request.post(`${API_URL}/ds160/load`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(await saved.json()).toMatchObject({ completado: true, datos: { apellidos: "Prueba Ramirez" } });
  });

  test("sube los tres documentos obligatorios y el asesor los aprueba", async ({ page }) => {
    await login(page, client);
    await page.goto("/documents");

    const inputs = page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(3);
    await inputs.nth(0).setInputFiles(fixture("pasaporte.png"));
    await expect(page.getByText("Subido (En revisión)")).toHaveCount(1);
    await inputs.nth(1).setInputFiles(fixture("foto-visa.png"));
    await expect(page.getByText("Subido (En revisión)")).toHaveCount(2);
    await inputs.nth(2).setInputFiles(fixture("formulario-asesor.pdf"));
    await expect(page.getByText("Subido (En revisión)")).toHaveCount(3);

    expect(await staff.approveDocuments(client.correo)).toBe(3);
    await page.reload();
    await expect(page.getByText("Revisado (Aprobado)")).toHaveCount(3);
  });

  test("registra la transferencia del pago y el asesor lo confirma", async ({ page }) => {
    await login(page, client);
    await page.goto("/pagos");

    await page.getByLabel(/Referencia o número de boleta/).fill(`BOL-${suffix}`);
    await page.getByLabel(/Comprobante obligatorio/).setInputFiles(fixture("comprobante-pago.png"));
    await page.getByRole("button", { name: /Registrar transferencia/ }).click();
    await expect(page.getByText("Validación pendiente")).toBeVisible();

    await staff.completeConsularPayment(client.correo, {
      name: "recibo-consular.png",
      mimeType: "image/png",
      buffer: fs.readFileSync(fixture("comprobante-pago.png")),
    });
    await page.reload();
    await expect(page.getByText("Transferencia confirmada")).toBeVisible();
  });

  test("ve la cita consular que registró su asesor", async ({ page }) => {
    await staff.registerAppointment(clientId, `CONF-${suffix}`);
    await login(page, client);
    await page.goto("/citas");

    await expect(page.getByRole("heading", { name: "Cita consular", level: 1 })).toBeVisible();
    await expect(page.locator("strong", { hasText: `CONF-${suffix}` })).toBeVisible();
    await expect(page.getByText("Pago oficial registrado")).toBeVisible();
  });

  test("practica la entrevista con el simulador y envía sus respuestas a retroalimentación", async ({ page }) => {
    await login(page, client);
    await page.goto("/entrevista");
    await expect(page.getByRole("heading", { name: "Entrevista Consular" })).toBeVisible();

    await page.getByRole("button", { name: /Iniciar simulador/ }).click();
    await expect(page).toHaveURL(/\/entrevista\/simulador/);
    await expect(page.getByText("Simulador en curso")).toBeVisible();

    const total = Number((await page.locator(".sim-hero h1 span").innerText()).replace(/\D/g, ""));
    expect(total).toBeGreaterThanOrEqual(1);
    for (let question = 1; question <= total; question += 1) {
      await page.getByRole("button", { name: "Grabar mi respuesta" }).click();
      await page.waitForTimeout(1_200);
      await page.getByRole("button", { name: /Detener grabación/ }).click();
      await expect(page.getByText("Respuesta grabada")).toBeVisible();
      await page.getByRole("button", { name: question === total ? "Finalizar entrevista" : "Siguiente pregunta" }).click();
    }

    await expect(page).toHaveURL(/\/entrevista\/retroalimentacion/, { timeout: 30_000 });
  });
});

// Inicia sesión por la pantalla de login y espera a que la página termine de validar la
// sesión antes de seguir. Importante: si se navega mientras `/validar-sesion` sigue en
// vuelo, el navegador aborta la petición y la app interpreta el error como sesión inválida
// y la borra (ver ../docs/e2e.md, "Hallazgos").
async function login(page, user) {
  await page.goto("/login");
  await page.locator("#login-correo").fill(user.correo);
  await page.locator("#login-contrasena").fill(user.contrasena);
  await page.getByRole("button", { name: /Iniciar sesión|Ingresar|Entrar/ }).click();
  await page.waitForURL(/\/(dashboard|seleccion-perfil)/);
  await expect(page.locator("main h1").first()).toBeVisible();
}
