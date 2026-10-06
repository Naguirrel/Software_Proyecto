/**
 * Templates de email HTML para VisaGuide
 */

const BRAND_COLOR = "#E11D48";
const BRAND_NAVY = "#0F172A";

function baseTemplate(content, preheader = "") {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>VisaGuide</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; background-color: ${BRAND_NAVY}; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff;">
                <span style="color: ${BRAND_COLOR};">Visa</span>Guide
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
                Este correo fue enviado por VisaGuide
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} VisaGuide. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonStyle() {
  return `display: inline-block; padding: 14px 32px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 10px;`;
}

// Template: Verificación de email
function emailVerification({ nombre, verifyUrl }) {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: ${BRAND_NAVY};">
      ¡Bienvenido a VisaGuide!
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hola <strong>${nombre}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Gracias por registrarte en VisaGuide. Para completar tu registro y comenzar tu proceso de visa, por favor verifica tu correo electrónico.
    </p>
    <p style="margin: 0 0 32px; text-align: center;">
      <a href="${verifyUrl}" style="${buttonStyle()}">
        Verificar mi correo
      </a>
    </p>
    <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
      O copia y pega este enlace en tu navegador:
    </p>
    <p style="margin: 0 0 24px; font-size: 13px; color: #9ca3af; word-break: break-all;">
      ${verifyUrl}
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Este enlace expira en <strong>24 horas</strong>. Si no creaste esta cuenta, puedes ignorar este mensaje.
    </p>
  `;
  return {
    html: baseTemplate(content, "Verifica tu correo para comenzar con VisaGuide"),
    text: `Hola ${nombre},\n\nGracias por registrarte en VisaGuide. Verifica tu correo usando este enlace:\n\n${verifyUrl}\n\nEste enlace expira en 24 horas.\n\nSi no creaste esta cuenta, ignora este mensaje.`,
  };
}

// Template: Recuperación de contraseña
function passwordReset({ nombre, resetUrl }) {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: ${BRAND_NAVY};">
      Restablecer contraseña
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hola <strong>${nombre}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en VisaGuide. Haz clic en el botón para crear una nueva contraseña.
    </p>
    <p style="margin: 0 0 32px; text-align: center;">
      <a href="${resetUrl}" style="${buttonStyle()}">
        Restablecer contraseña
      </a>
    </p>
    <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
      O copia y pega este enlace en tu navegador:
    </p>
    <p style="margin: 0 0 24px; font-size: 13px; color: #9ca3af; word-break: break-all;">
      ${resetUrl}
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje.
    </p>
  `;
  return {
    html: baseTemplate(content, "Restablece tu contraseña de VisaGuide"),
    text: `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contraseña. Usa este enlace:\n\n${resetUrl}\n\nEste enlace expira en 1 hora.\n\nSi no solicitaste este cambio, ignora este mensaje.`,
  };
}

// Template: Documento revisado
function documentReviewed({ nombre, documentName, status, feedback, dashboardUrl }) {
  const statusConfig = {
    approved: { label: "Aprobado", color: "#059669", bgColor: "#d1fae5" },
    correction: { label: "Requiere corrección", color: "#d97706", bgColor: "#fef3c7" },
    rejected: { label: "Rechazado", color: "#dc2626", bgColor: "#fee2e2" },
  };
  const { label, color, bgColor } = statusConfig[status] || statusConfig.correction;

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: ${BRAND_NAVY};">
      Actualización de documento
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hola <strong>${nombre}</strong>,
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
      Tu documento <strong>"${documentName}"</strong> ha sido revisado por nuestro equipo.
    </p>
    <p style="margin: 0 0 24px;">
      <span style="display: inline-block; padding: 8px 16px; background-color: ${bgColor}; color: ${color}; font-weight: 600; border-radius: 8px;">
        ${label}
      </span>
    </p>
    ${feedback ? `
    <div style="margin: 0 0 24px; padding: 16px; background-color: #f8fafc; border-left: 4px solid ${BRAND_COLOR}; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #64748b;">Observaciones:</p>
      <p style="margin: 0; font-size: 15px; color: #374151;">${feedback}</p>
    </div>
    ` : ""}
    <p style="margin: 0 0 32px; text-align: center;">
      <a href="${dashboardUrl}" style="${buttonStyle()}">
        Ver mis documentos
      </a>
    </p>
  `;
  return {
    html: baseTemplate(content, `Tu documento "${documentName}" ha sido revisado`),
    text: `Hola ${nombre},\n\nTu documento "${documentName}" ha sido revisado.\n\nEstado: ${label}\n${feedback ? `\nObservaciones: ${feedback}\n` : ""}\nRevisa los detalles en: ${dashboardUrl}`,
  };
}

// Template: Recordatorio de documento pendiente
function documentReminder({ nombre, documentName, dashboardUrl }) {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: ${BRAND_NAVY};">
      Recordatorio de documento pendiente
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hola <strong>${nombre}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Te recordamos que tienes un documento pendiente de completar o revisar: <strong>"${documentName}"</strong>
    </p>
    <p style="margin: 0 0 32px; text-align: center;">
      <a href="${dashboardUrl}" style="${buttonStyle()}">
        Continuar mi trámite
      </a>
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Completa tus documentos a tiempo para evitar retrasos en tu proceso de visa.
    </p>
  `;
  return {
    html: baseTemplate(content, `Recordatorio: documento "${documentName}" pendiente`),
    text: `Hola ${nombre},\n\nTe recordamos que tienes un documento pendiente: "${documentName}"\n\nContinúa tu trámite en: ${dashboardUrl}`,
  };
}

// Template: Retroalimentación de entrevista disponible
function interviewFeedback({ nombre, dashboardUrl }) {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: ${BRAND_NAVY};">
      Retroalimentación disponible
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hola <strong>${nombre}</strong>,
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Tu práctica de entrevista ha sido revisada por nuestro equipo. Ya puedes consultar la retroalimentación y recomendaciones para mejorar tu preparación.
    </p>
    <p style="margin: 0 0 32px; text-align: center;">
      <a href="${dashboardUrl}" style="${buttonStyle()}">
        Ver retroalimentación
      </a>
    </p>
  `;
  return {
    html: baseTemplate(content, "Tu práctica de entrevista ha sido revisada"),
    text: `Hola ${nombre},\n\nTu práctica de entrevista ha sido revisada. Consulta la retroalimentación en: ${dashboardUrl}`,
  };
}

// Template: Cambio de etapa del trámite
function stageChange({ nombre, newStage, dashboardUrl }) {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: ${BRAND_NAVY};">
      ¡Tu trámite avanzó!
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hola <strong>${nombre}</strong>,
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
      Tu proceso de visa ha avanzado a una nueva etapa:
    </p>
    <p style="margin: 0 0 24px;">
      <span style="display: inline-block; padding: 12px 20px; background-color: #dbeafe; color: #1d4ed8; font-weight: 700; font-size: 18px; border-radius: 10px;">
        ${newStage}
      </span>
    </p>
    <p style="margin: 0 0 32px; text-align: center;">
      <a href="${dashboardUrl}" style="${buttonStyle()}">
        Ver mi progreso
      </a>
    </p>
  `;
  return {
    html: baseTemplate(content, `Tu trámite avanzó a: ${newStage}`),
    text: `Hola ${nombre},\n\nTu proceso de visa avanzó a: ${newStage}\n\nRevisa tu progreso en: ${dashboardUrl}`,
  };
}

module.exports = {
  emailVerification,
  passwordReset,
  documentReviewed,
  documentReminder,
  interviewFeedback,
  stageChange,
};