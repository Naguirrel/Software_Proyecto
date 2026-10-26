const PROFILE_KEYS = Object.freeze([
  "turismo_negocios",
  "estudiante",
  "renovacion",
  "grupo_familiar",
  "adulto_mayor",
]);

const DOCUMENT_CATALOG = Object.freeze({
  passport: {
    key: "passport",
    title: "Página de datos del pasaporte vigente",
    category: "Documento oficial",
    type: "image_or_pdf",
    requirement: "required",
    scope: "official",
    helpText: "Debe identificar claramente al solicitante y permanecer vigente para el viaje.",
  },
  photo: {
    key: "photo",
    title: "Fotografía digital para visa estadounidense",
    category: "Documento oficial",
    type: "image",
    requirement: "required",
    scope: "official",
    helpText: "Fotografía reciente, a color y con fondo blanco o blanco hueso.",
  },
  "intake-form": {
    key: "intake-form",
    title: "Formulario interno de preparación VisaGuide",
    category: "Documento interno",
    type: "pdf",
    requirement: "recommended",
    scope: "internal",
    helpText: "Ayuda al asesor a preparar el expediente; no es un requisito del Gobierno de Estados Unidos.",
  },
  "travel-purpose": {
    key: "travel-purpose",
    title: "Evidencia del propósito del viaje",
    category: "Documento de respaldo",
    type: "any",
    requirement: "recommended",
    scope: "supporting",
    helpText: "Puede incluir itinerario, registro de conferencia o información de la actividad prevista.",
  },
  "financial-support": {
    key: "financial-support",
    title: "Evidencia de fondos para el viaje o los estudios",
    category: "Documento de respaldo",
    type: "pdf",
    requirement: "recommended",
    scope: "supporting",
    helpText: "El oficial puede solicitar evidencia de quién cubrirá los gastos y de que existen fondos suficientes.",
  },
  "guatemala-ties": {
    key: "guatemala-ties",
    title: "Evidencia de vínculos con Guatemala",
    category: "Documento de respaldo",
    type: "pdf",
    requirement: "recommended",
    scope: "supporting",
    helpText: "Por ejemplo, constancia laboral, estudios, empresa o compromisos familiares. No es obligatoria en todos los casos.",
  },
  "previous-visa": {
    key: "previous-visa",
    title: "Copia de la visa B1/B2 anterior",
    category: "Renovación",
    type: "image_or_pdf",
    requirement: "required",
    scope: "official",
    helpText: "Incluye la visa anterior y, si está en otro pasaporte, la página de datos de ese pasaporte.",
  },
  "renewal-support": {
    key: "renewal-support",
    title: "Confirmación del proceso de renovación",
    category: "Renovación",
    type: "pdf",
    requirement: "conditional",
    scope: "official",
    helpText: "Cárgala solamente cuando el portal oficial indique entrega de documentos o exención de entrevista.",
  },
  "form-i20": {
    key: "form-i20",
    title: "Formulario I-20 firmado",
    category: "Estudiante F/M",
    type: "pdf",
    requirement: "required",
    scope: "official",
    helpText: "Debe ser emitido por la institución autorizada y estar firmado por la institución y el estudiante.",
  },
  "sevis-i901-receipt": {
    key: "sevis-i901-receipt",
    title: "Comprobante de pago I-901 SEVIS",
    category: "Estudiante F/M",
    type: "pdf",
    requirement: "required",
    scope: "official",
    helpText: "Corresponde al pago SEVIS del estudiante principal; es distinto de la tarifa MRV.",
  },
  "admission-letter": {
    key: "admission-letter",
    title: "Carta de admisión de la institución",
    category: "Respaldo académico",
    type: "pdf",
    requirement: "recommended",
    scope: "supporting",
    helpText: "Respalda la admisión, el programa y las fechas de estudio.",
  },
  "academic-records": {
    key: "academic-records",
    title: "Certificados, diplomas, notas o resultados académicos",
    category: "Respaldo académico",
    type: "pdf",
    requirement: "recommended",
    scope: "supporting",
    helpText: "El oficial puede solicitarlos para comprobar la preparación académica del estudiante.",
  },
});

const COMMON_B_DOCUMENTS = Object.freeze([
  "passport",
  "photo",
  "travel-purpose",
  "financial-support",
  "guatemala-ties",
  "intake-form",
]);

const COMMON_OFFICIAL_CHECKLIST = Object.freeze([
  { stage: "preparation", label: "Pasaporte vigente", requirement: "required", note: "Presenta el pasaporte original el día indicado por el portal oficial." },
  { stage: "ds160", label: "Página de confirmación del DS-160", requirement: "required", note: "Se obtiene después de enviar un DS-160 individual." },
  { stage: "appointment", label: "Confirmación e instrucciones de la cita", requirement: "required", note: "Sigue exactamente los documentos y el lugar indicados por el portal oficial." },
  { stage: "interview", label: "Fotografía impresa si falló la carga digital", requirement: "conditional", note: "Debe cumplir las especificaciones vigentes del Departamento de Estado." },
]);

const PROFILE_CONFIGS = Object.freeze({
  turismo_negocios: {
    key: "turismo_negocios",
    label: "Turismo / Negocios B1/B2",
    visaClass: "B1/B2",
    applicationType: "first_time",
    caseType: "individual",
    seniorDefault: false,
    interviewPolicy: "required",
    governmentFeeUsdCentsPerPerson: 18500,
    documents: COMMON_B_DOCUMENTS,
    officialChecklist: COMMON_OFFICIAL_CHECKLIST,
    guidance: "Solicitud temporal por turismo, visitas o actividades de negocios permitidas. No autoriza empleo en Estados Unidos.",
  },
  estudiante: {
    key: "estudiante",
    label: "Estudiante F/M",
    visaClass: "F/M",
    applicationType: "first_time",
    caseType: "individual",
    seniorDefault: false,
    interviewPolicy: "required",
    governmentFeeUsdCentsPerPerson: 18500,
    sevisFeeUsdCents: 35000,
    documents: [
      "passport",
      "photo",
      "form-i20",
      "sevis-i901-receipt",
      "admission-letter",
      "academic-records",
      "financial-support",
      "guatemala-ties",
      "intake-form",
    ],
    officialChecklist: [
      ...COMMON_OFFICIAL_CHECKLIST,
      { stage: "preparation", label: "Formulario I-20 original y firmado", requirement: "required", note: "Los datos deben coincidir con el DS-160 y el registro SEVIS." },
      { stage: "payment", label: "Comprobante I-901 SEVIS", requirement: "required", note: "Es un pago separado de la tarifa de solicitud de visa." },
      { stage: "interview", label: "Evidencia académica y de preparación", requirement: "recommended", note: "Notas, diplomas, certificados y resultados de exámenes que correspondan." },
      { stage: "interview", label: "Evidencia de fondos para estudios y manutención", requirement: "recommended", note: "Puede incluir fondos propios, patrocinio o beca." },
    ],
    guidance: "Requiere admisión en una institución autorizada, I-20, registro SEVIS y evidencia de capacidad académica y financiera.",
  },
  renovacion: {
    key: "renovacion",
    label: "Renovación B1/B2",
    visaClass: "B1/B2",
    applicationType: "renewal",
    caseType: "individual",
    seniorDefault: false,
    interviewPolicy: "conditional_official_decision",
    governmentFeeUsdCentsPerPerson: 18500,
    documents: [
      "passport",
      "photo",
      "previous-visa",
      "renewal-support",
      "financial-support",
      "guatemala-ties",
      "intake-form",
    ],
    officialChecklist: [
      ...COMMON_OFFICIAL_CHECKLIST,
      { stage: "preparation", label: "Visa B1/B2 anterior y pasaporte que la contiene", requirement: "required", note: "El proceso sigue requiriendo un DS-160 y una tarifa nuevos." },
      { stage: "appointment", label: "Carta o instrucciones de entrega de documentos", requirement: "conditional", note: "Solo si el sistema oficial confirma exención inicial de entrevista." },
    ],
    guidance: "Renovar exige un DS-160 nuevo y un pago nuevo. El portal oficial decide si corresponde entrega de documentos o entrevista.",
  },
  grupo_familiar: {
    key: "grupo_familiar",
    label: "Grupo familiar B1/B2",
    visaClass: "B1/B2",
    applicationType: "first_time",
    caseType: "family",
    seniorDefault: false,
    interviewPolicy: "required",
    governmentFeeUsdCentsPerPerson: 18500,
    documents: COMMON_B_DOCUMENTS,
    perMemberDocuments: ["passport", "photo"],
    officialChecklist: [
      ...COMMON_OFFICIAL_CHECKLIST,
      { stage: "preparation", label: "Pasaporte y fotografía de cada integrante", requirement: "required", note: "Los documentos no se comparten entre solicitantes." },
      { stage: "ds160", label: "Confirmación DS-160 individual de cada integrante", requirement: "required", note: "Cada persona debe tener su propio número de confirmación." },
      { stage: "payment", label: "Tarifa de solicitud por cada integrante", requirement: "required", note: "La evaluación de visa también es individual." },
    ],
    guidance: "El grupo comparte seguimiento, pero cada integrante necesita pasaporte, DS-160, tarifa y evaluación individual.",
  },
  adulto_mayor: {
    key: "adulto_mayor",
    label: "Adulto mayor — B1/B2 con asistencia accesible",
    visaClass: "B1/B2",
    applicationType: "first_time_or_renewal",
    caseType: "individual",
    seniorDefault: true,
    interviewPolicy: "required_unless_officially_waived",
    governmentFeeUsdCentsPerPerson: 18500,
    documents: COMMON_B_DOCUMENTS,
    officialChecklist: COMMON_OFFICIAL_CHECKLIST,
    guidance: "La edad no elimina automáticamente la entrevista. VisaGuide activa una experiencia accesible desde el inicio.",
  },
});

function normalizeProfileKey(profile) {
  const value = String(profile || "").trim().toLowerCase();
  if (PROFILE_KEYS.includes(value)) return value;
  if (value.includes("estudiante") || value.includes("f1") || value.includes("f/m")) return "estudiante";
  if (value.includes("renov")) return "renovacion";
  if (value.includes("familiar") || value.includes("grupo")) return "grupo_familiar";
  if (value.includes("mayor") || value.includes("senior")) return "adulto_mayor";
  if (value.includes("turismo") || value.includes("negocio") || value.includes("b1") || value.includes("b2")) {
    return "turismo_negocios";
  }
  return null;
}

function getProfileConfig(profile) {
  const key = normalizeProfileKey(profile);
  return key ? PROFILE_CONFIGS[key] : null;
}

function presentDocument(documentKey, overrides = {}) {
  const definition = DOCUMENT_CATALOG[documentKey];
  if (!definition) throw new Error(`Documento de perfil desconocido: ${documentKey}`);
  return {
    id: overrides.id || definition.key,
    baseKey: definition.key,
    title: overrides.title || definition.title,
    category: definition.category,
    type: definition.type,
    requirement: definition.requirement,
    required: definition.requirement === "required",
    scope: definition.scope,
    helpText: definition.helpText,
    applicant: overrides.applicant || null,
    familyMemberId: overrides.familyMemberId || null,
  };
}

function getDocumentsForProfile(profile, familyMembers = []) {
  const config = getProfileConfig(profile);
  if (!config) return [];

  const documents = config.documents.map((key) => presentDocument(key));
  if (config.caseType !== "family") return documents;

  for (const member of familyMembers) {
    for (const key of config.perMemberDocuments) {
      const definition = DOCUMENT_CATALOG[key];
      documents.push(presentDocument(key, {
        id: `family-${member.id}-${key}`,
        title: `${definition.title} — ${member.full_name}`,
        applicant: member.full_name,
        familyMemberId: member.id,
      }));
    }
  }
  return documents;
}

function getRequiredDocumentKeys(profile, familyMembers = []) {
  return getDocumentsForProfile(profile, familyMembers)
    .filter((document) => document.required)
    .map((document) => document.id);
}

module.exports = {
  DOCUMENT_CATALOG,
  PROFILE_CONFIGS,
  PROFILE_KEYS,
  getDocumentsForProfile,
  getProfileConfig,
  getRequiredDocumentKeys,
  normalizeProfileKey,
};
