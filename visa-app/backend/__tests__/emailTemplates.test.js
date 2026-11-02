const { emailVerification, passwordReset, accountLocked } = require("../templates/emailTemplates");
const { loadEmailBranding, normalizeWebsite } = require("../services/emailBrandingService");

describe("plantillas de correo", () => {
  const maliciousName = '<a href="https://phishing.example">Haz clic</a>';

  test.each([
    ["verificación", () => emailVerification({ nombre: "Ana", verifyUrl: "http://localhost:8080/verificar-email?token=abc" }), "Verificar mi correo"],
    ["recuperación", () => passwordReset({ nombre: "Ana", resetUrl: "http://localhost:8080/restablecer-contrasena?token=abc" }), "Restablecer contraseña"],
  ])("el correo de %s incluye HTML con botón y una versión de texto", (_name, build, buttonText) => {
    const email = build();

    expect(email.html).toContain("<!DOCTYPE html>");
    expect(email.html).toContain(buttonText);
    expect(email.html).toContain("token=abc");
    expect(email.text).toContain("token=abc");
    expect(email.text).not.toContain("<");
  });

  test.each([
    ["verificación", () => emailVerification({ nombre: maliciousName, verifyUrl: "http://localhost:8080/verificar-email?token=abc" })],
    ["recuperación", () => passwordReset({ nombre: maliciousName, resetUrl: "http://localhost:8080/restablecer-contrasena?token=abc" })],
    ["cuenta bloqueada", () => accountLocked({ nombre: maliciousName, minutos: 15, unlockUrl: "http://localhost:8080/desbloquear-cuenta?token=abc", resetUrl: "http://localhost:8080/recuperar-contrasena" })],
  ])("el correo de %s escapa el HTML del nombre", (_name, build) => {
    const { html } = build();

    expect(html).not.toContain("phishing.example\">Haz clic</a>");
    expect(html).toContain("&#60;a href=&#34;https://phishing.example&#34;&#62;Haz clic&#60;/a&#62;");
  });

  const resetEmail = (branding) => passwordReset({ nombre: "Ana", resetUrl: "http://localhost:8080/r", branding }).html;

  test("sin configuración el pie usa VisaGuide y no muestra sitio", () => {
    const html = resetEmail(undefined);

    expect(html).toContain("Este correo fue enviado por VisaGuide");
    expect(html).toContain("VisaGuide. Todos los derechos reservados.");
    expect(html).not.toContain('style="color: #64748b;"');
  });

  test("el pie muestra el nombre comercial y enlaza el sitio", () => {
    const html = resetEmail({ nombreComercial: "Agencia Quetzal", sitioWeb: "https://quetzal.test" });

    expect(html).toContain("Este correo fue enviado por Agencia Quetzal");
    expect(html).toContain("Agencia Quetzal. Todos los derechos reservados.");
    expect(html).toContain('<a href="https://quetzal.test"');
  });

  test("el pie escapa el nombre comercial", () => {
    const html = resetEmail({ nombreComercial: "<img src=x>" });

    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&#60;img src=x&#62;");
  });

  test.each([
    ["javascript:alert(1)", ""],
    ["data:text/html,hola", ""],
    ["no es una url", ""],
    ["", ""],
    [null, ""],
    ["https://quetzal.test", "https://quetzal.test"],
    ["  http://quetzal.test/agencia  ", "http://quetzal.test/agencia"],
  ])("normalizeWebsite(%j) devuelve %j", (value, expected) => {
    expect(normalizeWebsite(value)).toBe(expected);
  });

  test("si no se puede leer la configuración, se envía con la marca por defecto", async () => {
    const pool = { query: jest.fn(() => Promise.reject(new Error("relation admin_settings does not exist"))) };

    await expect(loadEmailBranding(pool)).resolves.toEqual({});
  });
});
