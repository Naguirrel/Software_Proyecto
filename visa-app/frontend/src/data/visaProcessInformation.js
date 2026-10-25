const createStage = (title, description) => Object.freeze({ title, description });

const COMMON_DS160 = createStage(
  "Formulario DS-160",
  "Completa un DS-160 nuevo con información exacta y coherente. Conserva la página de confirmación para tu cita o entrega de documentos."
);

const VISA_PROCESS_INFORMATION = Object.freeze({
  turismo_negocios: Object.freeze({
    subtitle: "Etapas esenciales de una solicitud de visa B1/B2 para turismo o negocios.",
    highlightTitle: "El DS-160 debe reflejar tu viaje real",
    highlightText: "El formulario es una declaración oficial. Revisa fechas, propósito del viaje, empleo y antecedentes antes de enviarlo; la decisión corresponde exclusivamente al oficial consular.",
    stages: Object.freeze([
      createStage("Perfil y plan de viaje", "Define el propósito de tu visita, fechas aproximadas y quién cubrirá los gastos."),
      COMMON_DS160,
      createStage("Documentos de respaldo", "Prepara pasaporte, fotografía y evidencia pertinente sobre el propósito del viaje, recursos y vínculos con Guatemala. Los documentos de respaldo no garantizan la aprobación."),
      createStage("Tarifa y cita", "Paga la tarifa indicada en el portal oficial y agenda las citas que el sistema determine para tu caso."),
      createStage("Entrevista y decisión", "Lleva las confirmaciones y documentos indicados. Responde con claridad; el consulado toma la decisión final."),
    ]),
  }),
  estudiante: Object.freeze({
    subtitle: "Etapas esenciales de una solicitud de visa F o M para estudiar en Estados Unidos.",
    highlightTitle: "Tu Formulario I-20 y SEVIS son indispensables",
    highlightText: "Antes de solicitar la visa debes ser aceptado por una institución certificada por SEVP, verificar y firmar tu I-20, y cumplir el pago SEVIS I-901 que corresponda.",
    stages: Object.freeze([
      createStage("Admisión académica", "Obtén la aceptación de una institución certificada por SEVP y confirma que tus datos y programa estén correctos."),
      createStage("I-20 y SEVIS I-901", "Firma tu Formulario I-20, paga SEVIS I-901 cuando corresponda y conserva el comprobante."),
      COMMON_DS160,
      createStage("Tarifa y cita", "Paga la tarifa de solicitud de visa y agenda la cita siguiendo las instrucciones vigentes del portal oficial."),
      createStage("Expediente y entrevista", "Presenta pasaporte, confirmaciones, I-20, comprobante SEVIS y evidencia académica y financiera. Debes poder explicar tu plan de estudios y cómo lo financiarás."),
    ]),
  }),
  renovacion: Object.freeze({
    subtitle: "Etapas esenciales para renovar una visa B1/B2.",
    highlightTitle: "La exención de entrevista nunca es automática",
    highlightText: "El portal oficial evalúa tu caso con datos actuales. Aunque inicialmente permita entregar documentos, el consulado puede solicitar una entrevista en cualquier momento.",
    stages: Object.freeze([
      createStage("Visa anterior", "Ten disponibles el pasaporte actual, la visa anterior y los datos sobre su emisión, vencimiento y cualquier denegación posterior."),
      COMMON_DS160,
      createStage("Evaluación inicial", "Responde la evaluación de renovación con precisión. La plataforma solo muestra una elegibilidad potencial; no decide la exención."),
      createStage("Tarifa e instrucciones", "Paga la tarifa aplicable y sigue exactamente la ruta de entrega o cita que muestre el portal oficial."),
      createStage("Revisión consular", "Entrega los documentos indicados y permanece atento: un oficial puede requerir información adicional o entrevista."),
    ]),
  }),
  grupo_familiar: Object.freeze({
    subtitle: "Etapas esenciales para coordinar solicitudes B1/B2 de un grupo familiar.",
    highlightTitle: "Cada integrante presenta una solicitud individual",
    highlightText: "El grupo puede coordinar seguimiento y citas, pero cada persona necesita su propio DS-160, pasaporte, fotografía, tarifa y evaluación consular.",
    stages: Object.freeze([
      createStage("Registrar integrantes", "Agrega a cada solicitante con sus datos personales y parentesco para controlar el expediente familiar."),
      createStage("DS-160 por persona", "Completa y guarda una confirmación DS-160 independiente para cada integrante, incluidos menores."),
      createStage("Documentos individuales", "Prepara pasaporte, fotografía y respaldos aplicables para cada persona, además de documentos que expliquen el viaje familiar."),
      createStage("Tarifas y coordinación", "Registra la tarifa individual de cada solicitante y utiliza las opciones de grupo que ofrezca el portal oficial."),
      createStage("Entrevista y decisión", "Mantén consistentes los datos compartidos. Cada integrante es evaluado individualmente y puede recibir una decisión distinta."),
    ]),
  }),
  adulto_mayor: Object.freeze({
    subtitle: "Etapas esenciales de una solicitud B1/B2 con asistencia accesible.",
    highlightTitle: "La edad no elimina los requisitos consulares",
    highlightText: "El Modo Senior simplifica la interfaz y ofrece orientación adicional, pero no concede una exención automática de entrevista ni modifica la decisión del consulado.",
    stages: Object.freeze([
      createStage("Perfil y apoyo", "Confirma los datos del solicitante y define una persona de apoyo cuando sea necesario, sin perder el control sobre la información declarada."),
      COMMON_DS160,
      createStage("Documentos esenciales", "Prepara pasaporte, fotografía y los respaldos B1/B2 pertinentes. Revisa nombres y fechas con calma antes de continuar."),
      createStage("Tarifa y cita", "Sigue las instrucciones del portal oficial. Solicita asistencia o ajustes de accesibilidad con anticipación si los necesitas."),
      createStage("Entrevista y seguimiento", "Lleva las confirmaciones requeridas y coordina apoyo para el traslado. El consulado indicará si requiere entrevista o documentos adicionales."),
    ]),
  }),
});

export function getVisaProcessInformation(profile) {
  return VISA_PROCESS_INFORMATION[profile] || VISA_PROCESS_INFORMATION.turismo_negocios;
}

export { VISA_PROCESS_INFORMATION };
