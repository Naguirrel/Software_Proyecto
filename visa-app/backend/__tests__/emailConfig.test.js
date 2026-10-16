jest.mock("nodemailer", () => ({ createTransport: jest.fn(() => ({})) }));

const nodemailer = require("nodemailer");
const { createEmailTransporter } = require("../config/email");

describe("configuracion TLS del correo", () => {
  beforeEach(() => nodemailer.createTransport.mockClear());

  test("Resend usa TLS sin desactivar la validacion del certificado", () => {
    createEmailTransporter({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "test-key" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: { user: "resend", pass: "test-key" },
    });
  });

  test("SMTP generico conserva su configuracion segura", () => {
    createEmailTransporter({
      SMTP_HOST: "smtp.example.test",
      SMTP_USER: "test-user",
      SMTP_PASS: "test-pass",
      SMTP_SECURE: "true",
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.test",
      port: 587,
      secure: true,
      auth: { user: "test-user", pass: "test-pass" },
    });
  });
});
