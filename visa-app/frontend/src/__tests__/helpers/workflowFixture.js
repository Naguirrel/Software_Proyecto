// Respuestas de ejemplo de GET /workflow/me con la misma forma que devuelve
// backend/services/clientWorkflowService.js, para probar el checklist del dashboard.
const open = { allowed: true, reason: "", requiredStep: null, requiredPath: null };
const locked = (reason, requiredStep) => ({ allowed: false, reason, requiredStep, requiredPath: `/${requiredStep}` });

const baseRequirements = {
  profileComplete: false,
  ds160Complete: false,
  requiredDocuments: 3,
  requiredDocumentsUploaded: 0,
  requiredDocumentsApproved: 0,
  documentsUploaded: false,
  documentsApproved: false,
  paymentStarted: false,
  consularPaid: false,
  appointmentScheduled: false,
  interviewStarted: false,
};

const SCENARIOS = {
  // Cliente recién registrado: aún no elige su perfil.
  initial: {
    assigned: false,
    currentStep: "profile",
    requirements: {},
    gates: {
      ds160: locked("Completa tu perfil antes de iniciar el DS-160.", "profile"),
      payment: locked("Necesitas un asesor asignado antes de continuar con el pago.", "assignment"),
      appointment: locked("El pago consular debe estar confirmado antes de programar la cita.", "payment"),
      interview: locked("Necesitas una cita consular activa antes de iniciar la preparación de entrevista.", "appointment"),
    },
  },
  // Perfil elegido, esperando que un administrador asigne el asesor.
  profileDone: {
    assigned: false,
    currentStep: "assignment",
    requirements: { profileComplete: true },
    gates: {
      ds160: locked("Necesitas un asesor asignado antes de iniciar el DS-160.", "assignment"),
      payment: locked("Necesitas un asesor asignado antes de continuar con el pago.", "assignment"),
      appointment: locked("El pago consular debe estar confirmado antes de programar la cita.", "payment"),
      interview: locked("Necesitas una cita consular activa antes de iniciar la preparación de entrevista.", "appointment"),
    },
  },
  // Con asesor y DS-160 hecho; faltan por aprobar los documentos.
  partial: {
    assigned: true,
    currentStep: "documents",
    requirements: {
      profileComplete: true,
      ds160Complete: true,
      requiredDocumentsUploaded: 3,
      requiredDocumentsApproved: 2,
      documentsUploaded: true,
    },
    gates: {
      ds160: open,
      payment: locked("Los tres documentos obligatorios deben estar aprobados antes del pago.", "documents"),
      appointment: locked("El pago consular debe estar confirmado antes de programar la cita.", "payment"),
      interview: locked("Necesitas una cita consular activa antes de iniciar la preparación de entrevista.", "appointment"),
    },
  },
  // Documentos aprobados y transferencia registrada, en gestión consular.
  payment: {
    assigned: true,
    currentStep: "payment",
    requirements: {
      profileComplete: true,
      ds160Complete: true,
      requiredDocumentsUploaded: 3,
      requiredDocumentsApproved: 3,
      documentsUploaded: true,
      documentsApproved: true,
      paymentStarted: true,
    },
    gates: {
      ds160: open,
      payment: open,
      appointment: locked("El pago consular debe estar confirmado antes de programar la cita.", "payment"),
      interview: locked("Necesitas una cita consular activa antes de iniciar la preparación de entrevista.", "appointment"),
    },
  },
  // Todas las actividades cumplidas.
  complete: {
    assigned: true,
    currentStep: "interview",
    requirements: {
      profileComplete: true,
      ds160Complete: true,
      requiredDocumentsUploaded: 3,
      requiredDocumentsApproved: 3,
      documentsUploaded: true,
      documentsApproved: true,
      paymentStarted: true,
      consularPaid: true,
      appointmentScheduled: true,
      interviewStarted: true,
    },
    gates: { ds160: open, payment: open, appointment: open, interview: open },
  },
};

export function workflowFixture(name, overrides = {}) {
  const scenario = SCENARIOS[name];
  const { requirements = {}, gates = {}, ...rest } = overrides;
  return {
    assigned: false,
    advisorId: scenario.assigned ? 9 : null,
    currentStepLabel: "",
    process: null,
    ...scenario,
    ...rest,
    requirements: { ...baseRequirements, ...scenario.requirements, ...requirements },
    gates: { chat: open, profile: open, documents: open, ...scenario.gates, ...gates },
  };
}
