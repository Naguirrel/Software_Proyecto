const { emailVerification, passwordReset, accountLocked } = require("../templates/emailTemplates");

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
});
