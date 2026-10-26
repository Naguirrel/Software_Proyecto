// Aviso de privacidad (SP10-12). Si cambia el texto, se sube la versión aquí y en
// `backend/config/privacyNotice.js`: el registro guarda la versión que la persona aceptó.
export const PRIVACY_NOTICE_VERSION = "1.0";
export const PRIVACY_NOTICE_UPDATED = "26 de octubre de 2026";

export const PRIVACY_NOTICE_SECTIONS = [
  {
    id: "responsable",
    title: "Quién trata tus datos",
    paragraphs: [
      "VisaGuide (Guevara Advisory Services) es la plataforma con la que preparas tu proceso de visa. Trata tus datos personales para prestarte el servicio que se describe en este aviso.",
    ],
  },
  {
    id: "datos",
    title: "Qué datos recopilamos",
    items: [
      "Cuenta: nombre, correo electrónico y contraseña. La contraseña se guarda cifrada con un método de un solo sentido; ni siquiera el equipo puede verla.",
      "Perfil y trámite: tipo de visa, teléfono, ciudad, país, datos de tu situación de viaje, información del grupo familiar cuando aplica y, si la agregas, tu fotografía de perfil.",
      "Formulario DS-160 y documentos: las respuestas que registras y los archivos que subes, por ejemplo tu pasaporte.",
      "Práctica de entrevista: las respuestas que grabas en audio y la retroalimentación que recibes.",
      "Comunicación y pagos: mensajes con tu asesor, notificaciones y los comprobantes de pago que registras.",
      "Datos de seguridad: dirección IP, navegador, intentos de inicio de sesión y registro de acciones en tu cuenta.",
    ],
  },
  {
    id: "uso",
    title: "Para qué los usamos",
    items: [
      "Crear y mantener tu cuenta.",
      "Guiarte y gestionar tu trámite junto con tu asesor.",
      "Enviarte avisos y correos del servicio, como la verificación de tu correo, la recuperación de tu contraseña y recordatorios de tu trámite.",
      "Proteger la plataforma y tu cuenta contra accesos no autorizados.",
    ],
  },
  {
    id: "terceros",
    title: "Con quién se comparten",
    paragraphs: [
      "Tu asesor asignado y las personas administradoras de VisaGuide acceden a la información necesaria para tu trámite. Un asesor solo ve a las personas que tiene asignadas.",
      "Usamos proveedores de infraestructura para guardar archivos en la nube y enviar correos del servicio. No vendemos tus datos personales.",
    ],
  },
  {
    id: "seguridad",
    title: "Cómo los protegemos",
    items: [
      "Las contraseñas se almacenan cifradas.",
      "El acceso se controla con sesión y por rol (cliente, asesor y administrador).",
      "La conexión con la plataforma viaja cifrada.",
    ],
  },
  {
    id: "conservacion",
    title: "Cuánto tiempo los conservamos",
    paragraphs: [
      "Conservamos tus datos mientras tu cuenta esté activa y sean necesarios para tu trámite. Puedes pedir que se eliminen.",
    ],
  },
  {
    id: "derechos",
    title: "Tus derechos",
    paragraphs: [
      "Puedes acceder a tus datos, corregirlos (por ejemplo, desde tu perfil), pedir su eliminación y retirar tu consentimiento. Para ejercer estos derechos, comunícate con tu asesor asignado o con el equipo administrador de VisaGuide.",
    ],
  },
  {
    id: "consentimiento",
    title: "Consentimiento y cambios",
    paragraphs: [
      "Al crear tu cuenta aceptas este aviso. Guardamos la fecha y la versión que aceptaste.",
      "Si el aviso cambia, publicaremos una nueva versión en esta página.",
    ],
  },
];
