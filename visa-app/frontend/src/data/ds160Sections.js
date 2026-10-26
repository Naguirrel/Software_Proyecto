export const secciones = [
  {
    id: 1,
    titulo: "Datos Personales",
    campos: [
      { 
        name: "apellidos", 
        label: "APELLIDOS (TAL COMO APARECEN EN TU PASAPORTE)", 
        type: "text", 
        placeholder: "Ej: Cárdenas", 
        required: true,
        validation: { minLength: 2, maxLength: 50, pattern: "letras" },
        tip: "Si tu pasaporte tiene un solo apellido, ingresa solo ese apellido. No agregues el apellido de soltera si no está en el pasaporte.", 
        porque: "El consulado utiliza estos nombres exactos para verificar tus antecedentes penales y migratorios. Deben coincidir exactamente con los de tu pasaporte actual, letra por letra." 
      },
      { 
        name: "nombres", 
        label: "NOMBRES (TAL COMO APARECEN EN TU PASAPORTE)", 
        type: "text", 
        placeholder: "Ej: María", 
        required: true,
        validation: { minLength: 2, maxLength: 50, pattern: "letras" },
        tip: "No uses tildes ni la letra 'ñ'. El sistema oficial las transformará automáticamente (ej: Núñez → Nunez).", 
        porque: "El consulado utiliza estos nombres exactos para verificar tus antecedentes penales y migratorios." 
      },
      { name: "otrosNombres", label: "¿HAS USADO OTROS NOMBRES? (DE SOLTERA, RELIGIOSO, ETC.)", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "otrosNombresDetalle", label: "ESPECIFICA LOS OTROS NOMBRES", type: "text", placeholder: "Ej: María García (nombre de soltera)", dependeDe: { campo: "otrosNombres", valor: "Sí" } },
      { 
        name: "fechaNacimiento", 
        label: "FECHA DE NACIMIENTO", 
        type: "date", 
        required: true,
        validation: { tipo: "fechaPasada" },
        porque: "Se usa para verificar tu identidad y calcular tu edad al momento de la solicitud." 
      },
      { name: "lugarNacimiento", label: "CIUDAD DE NACIMIENTO", type: "text", placeholder: "Ej: Ciudad de Guatemala", required: true },
      { name: "paisNacimiento", label: "PAÍS DE NACIMIENTO", type: "text", placeholder: "Ej: Guatemala", required: true },
    ],
  },
  { 
    id: 2, 
    titulo: "Información de Contacto", 
    campos: [
      { 
        name: "direccion", 
        label: "DIRECCIÓN DE RESIDENCIA", 
        type: "text", 
        placeholder: "Calle, número, zona", 
        required: true,
        validation: { minLength: 10, maxLength: 200 }
      },
      { name: "ciudad", label: "CIUDAD", type: "text", placeholder: "Ej: Ciudad de Guatemala", required: true },
      { name: "codigoPostal", label: "CÓDIGO POSTAL", type: "text", placeholder: "Ej: 01010" },
      { 
        name: "telefono", 
        label: "NÚMERO DE TELÉFONO", 
        type: "tel", 
        placeholder: "Ej: +502 1234 5678", 
        required: true,
        validation: { minLength: 8, pattern: "telefono" }
      },
      { 
        name: "email", 
        label: "CORREO ELECTRÓNICO", 
        type: "email", 
        placeholder: "tu@correo.com", 
        required: true,
        validation: { pattern: "email" }
      },
    ]
  },
  { 
    id: 3, 
    titulo: "Información del Pasaporte", 
    campos: [
      { 
        name: "numeroPasaporte", 
        label: "NÚMERO DE PASAPORTE", 
        type: "text", 
        placeholder: "Ej: A12345678", 
        required: true,
        validation: { minLength: 6, maxLength: 20 }
      },
      { name: "paisEmision", label: "PAÍS DE EMISIÓN", type: "text", placeholder: "Ej: Guatemala", required: true },
      { 
        name: "fechaEmision", 
        label: "FECHA DE EMISIÓN", 
        type: "date", 
        required: true,
        validation: { tipo: "fechaPasada" }
      },
      { 
        name: "fechaExpiracion", 
        label: "FECHA DE EXPIRACIÓN", 
        type: "date", 
        required: true,
        validation: { tipo: "fechaFutura" },
        tip: "Tu pasaporte debe tener al menos 6 meses de vigencia al momento del viaje."
      },
    ]
  },
  { 
    id: 4, 
    titulo: "Información del Viaje", 
    campos: [
      { name: "proposito", label: "PROPÓSITO DEL VIAJE", type: "select", opciones: ["Turismo", "Negocios", "Estudio", "Trabajo", "Tratamiento médico", "Otro"], required: true },
      { 
        name: "fechaViaje", 
        label: "FECHA TENTATIVA DE VIAJE", 
        type: "date",
        validation: { tipo: "fechaFutura" }
      },
      { name: "duracionEstancia", label: "DURACIÓN ESTIMADA DE LA ESTANCIA", type: "text", placeholder: "Ej: 2 semanas, 3 meses" },
      { name: "direccionEEUU", label: "DIRECCIÓN DONDE TE HOSPEDARÁS EN EE.UU.", type: "text", placeholder: "Hotel, dirección de familiar, etc." },
    ]
  },
  { 
    id: 5, 
    titulo: "Acompañantes de Viaje", 
    campos: [
      { name: "viajaAcompanado", label: "¿VIAJAS ACOMPAÑADO?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "acompanantes", label: "NOMBRES DE LOS ACOMPAÑANTES", type: "text", placeholder: "Ej: Juan Pérez, María López", dependeDe: { campo: "viajaAcompanado", valor: "Sí" } },
      { name: "relacionAcompanantes", label: "RELACIÓN CON LOS ACOMPAÑANTES", type: "text", placeholder: "Ej: Esposo, Hijos", dependeDe: { campo: "viajaAcompanado", valor: "Sí" } },
    ]
  },
  { 
    id: 6, 
    titulo: "Viajes Anteriores a EE.UU.", 
    campos: [
      { name: "visitadoEEUU", label: "¿HAS VISITADO EE.UU. ANTES?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "fechasVisitas", label: "FECHAS DE VISITAS ANTERIORES", type: "text", placeholder: "Ej: Junio 2019, Diciembre 2021", dependeDe: { campo: "visitadoEEUU", valor: "Sí" } },
      { name: "visaAnterior", label: "¿HAS TENIDO VISA AMERICANA ANTES?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "visaRechazada", label: "¿TE HAN RECHAZADO UNA VISA ANTES?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "motivoRechazo", label: "MOTIVO DEL RECHAZO", type: "text", placeholder: "Explica brevemente", dependeDe: { campo: "visaRechazada", valor: "Sí" }, required: true },
    ]
  },
  { 
    id: 7, 
    titulo: "Información Laboral", 
    campos: [
      { name: "ocupacion", label: "OCUPACIÓN ACTUAL", type: "text", placeholder: "Ej: Ingeniero, Estudiante, Empresario", required: true },
      { name: "empleador", label: "NOMBRE DEL EMPLEADOR O INSTITUCIÓN", type: "text", placeholder: "Ej: Empresa S.A.", required: true },
      { 
        name: "direccionTrabajo", 
        label: "DIRECCIÓN DEL TRABAJO", 
        type: "text", 
        placeholder: "Dirección completa",
        validation: { minLength: 10 }
      },
      { 
        name: "telefonoTrabajo", 
        label: "TELÉFONO DEL TRABAJO", 
        type: "tel", 
        placeholder: "Ej: +502 2222 3333",
        validation: { pattern: "telefono" }
      },
      { 
        name: "ingresoMensual", 
        label: "INGRESO MENSUAL APROXIMADO (USD)", 
        type: "number", 
        placeholder: "Ej: 1500",
        validation: { min: 0 }
      },
    ]
  },
  { 
    id: 8, 
    titulo: "Información Educativa", 
    campos: [
      { name: "nivelEducativo", label: "NIVEL EDUCATIVO MÁS ALTO", type: "select", opciones: ["Primaria", "Secundaria", "Diversificado", "Universidad (incompleta)", "Universidad (completa)", "Maestría", "Doctorado"], required: true },
      { name: "institucion", label: "NOMBRE DE LA INSTITUCIÓN", type: "text", placeholder: "Ej: Universidad del Valle de Guatemala", required: true },
      { name: "carrera", label: "CARRERA O ÁREA DE ESTUDIO", type: "text", placeholder: "Ej: Ingeniería en Sistemas" },
    ]
  },
  { 
    id: 9, 
    titulo: "Información Familiar", 
    campos: [
      { name: "estadoCivil", label: "ESTADO CIVIL", type: "select", opciones: ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión libre"], required: true },
      { name: "nombreConyuge", label: "NOMBRE DEL CÓNYUGE", type: "text", placeholder: "Nombre completo", dependeDe: { campo: "estadoCivil", valor: "Casado/a" }, required: true },
      { name: "nombrePadre", label: "NOMBRE COMPLETO DEL PADRE", type: "text", placeholder: "Nombre completo", required: true },
      { name: "nombreMadre", label: "NOMBRE COMPLETO DE LA MADRE", type: "text", placeholder: "Nombre completo", required: true },
      { name: "familiaresEEUU", label: "¿TIENES FAMILIARES EN EE.UU.?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "detallesFamiliares", label: "DETALLES DE FAMILIARES EN EE.UU.", type: "text", placeholder: "Nombre, relación, estatus migratorio", dependeDe: { campo: "familiaresEEUU", valor: "Sí" } },
    ]
  },
  { 
    id: 10, 
    titulo: "Declaraciones de Seguridad", 
    campos: [
      { name: "enfermedadContagiosa", label: "¿TIENES ALGUNA ENFERMEDAD CONTAGIOSA?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "arrestado", label: "¿HAS SIDO ARRESTADO O CONDENADO POR ALGÚN DELITO?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "detallesArresto", label: "DETALLES DEL ARRESTO O CONDENA", type: "text", placeholder: "Explica brevemente", dependeDe: { campo: "arrestado", valor: "Sí" } },
      { name: "terrorismo", label: "¿HAS PARTICIPADO EN ACTIVIDADES TERRORISTAS O GENOCIDIO?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "deportado", label: "¿HAS SIDO DEPORTADO DE ALGÚN PAÍS?", type: "radio", opciones: ["Sí", "No"], required: true },
      { name: "detallesDeportacion", label: "DETALLES DE LA DEPORTACIÓN", type: "text", placeholder: "País, fecha, motivo", dependeDe: { campo: "deportado", valor: "Sí" } },
    ]
  },
];

export const totalSecciones = secciones.length;

const studentSection = {
  id: 11,
  titulo: "Información del programa de estudios",
  campos: [
    {
      name: "studentVisaClass",
      label: "CLASE DE VISA INDICADA EN TU I-20",
      type: "select",
      opciones: ["F-1", "M-1"],
      required: true,
      tip: "Selecciona exactamente la categoría que aparece en tu Formulario I-20.",
    },
    {
      name: "sevisId",
      label: "NÚMERO SEVIS",
      type: "text",
      placeholder: "Ej: N0012345678",
      required: true,
      validation: { minLength: 11, maxLength: 11, pattern: "sevis" },
      tip: "Lo encuentras en la esquina superior de tu I-20. Comienza con la letra N y contiene 10 dígitos.",
      porque: "Relaciona tu solicitud de visa con el registro creado por la institución en SEVIS.",
    },
    {
      name: "schoolName",
      label: "NOMBRE DE LA INSTITUCIÓN EN EE.UU.",
      type: "text",
      placeholder: "Tal como aparece en el I-20",
      required: true,
    },
    {
      name: "schoolSevisCode",
      label: "CÓDIGO SEVIS DE LA INSTITUCIÓN",
      type: "text",
      placeholder: "Ej: BOS214F00123000",
      required: true,
    },
    {
      name: "programName",
      label: "PROGRAMA O ÁREA DE ESTUDIO",
      type: "text",
      placeholder: "Ej: Bachelor of Science in Computer Science",
      required: true,
    },
    {
      name: "programStartDate",
      label: "FECHA DE INICIO DEL PROGRAMA",
      type: "date",
      required: true,
    },
    {
      name: "studyFundingSource",
      label: "¿QUIÉN FINANCIARÁ TUS ESTUDIOS Y MANUTENCIÓN?",
      type: "text",
      placeholder: "Ej: Fondos propios, padres, beca de la universidad",
      required: true,
      porque: "El oficial puede pedir evidencia de que cuentas con recursos suficientes para estudiar sin empleo no autorizado.",
    },
  ],
};

const renewalSection = {
  id: 11,
  titulo: "Datos de la visa anterior",
  campos: [
    {
      name: "previousVisaNumber",
      label: "NÚMERO DE LA VISA ANTERIOR",
      type: "text",
      placeholder: "Número impreso en rojo en la visa",
      required: true,
    },
    {
      name: "previousVisaIssueDate",
      label: "FECHA DE EMISIÓN DE LA VISA ANTERIOR",
      type: "date",
      required: true,
      validation: { tipo: "fechaPasada" },
    },
    {
      name: "previousVisaExpirationDate",
      label: "FECHA DE VENCIMIENTO DE LA VISA ANTERIOR",
      type: "date",
      required: true,
    },
    {
      name: "previousVisaSameClass",
      label: "¿SOLICITAS LA MISMA CATEGORÍA B1/B2?",
      type: "radio",
      opciones: ["Sí", "No"],
      required: true,
      tip: "La plataforma evalúa renovación B1/B2. El portal oficial decide si debes presentarte a entrevista.",
    },
    {
      name: "previousVisaLostOrStolen",
      label: "¿LA VISA ANTERIOR FUE PERDIDA O ROBADA?",
      type: "radio",
      opciones: ["Sí", "No"],
      required: true,
    },
    {
      name: "previousVisaLostDetails",
      label: "EXPLICA CUÁNDO Y DÓNDE OCURRIÓ",
      type: "text",
      placeholder: "Incluye si presentaste una denuncia",
      required: true,
      dependeDe: { campo: "previousVisaLostOrStolen", valor: "Sí" },
    },
  ],
};

export function getDs160Sections(profile) {
  if (profile === "estudiante") return [...secciones, studentSection];
  if (profile === "renovacion") return [...secciones, renewalSection];
  return secciones;
}
