// Checklist del trámite del cliente. Las actividades y sus reglas de cumplimiento son las
// del backend (`backend/services/clientWorkflowService.js`, endpoint GET /workflow/me): aquí
// solo se presentan, sin inventar actividades ni estados ni marcar nada por su posición.

export const CHECKLIST_ORDER = ["profile", "assignment", "ds160", "documents", "payment", "appointment", "interview"];

// Mismas rutas que usa el backend para cada etapa (STEP_DEFINITIONS). La asignación del
// asesor no tiene pantalla propia: la hace un administrador.
const STEP_PATHS = {
  profile: "/perfil",
  assignment: null,
  ds160: "/ds160",
  documents: "/documents",
  payment: "/pagos",
  appointment: "/citas",
  interview: "/entrevista",
};

const IS_DONE = {
  profile: (workflow) => workflow.requirements.profileComplete,
  assignment: (workflow) => workflow.assigned,
  ds160: (workflow) => workflow.requirements.ds160Complete,
  documents: (workflow) => workflow.requirements.documentsApproved,
  payment: (workflow) => workflow.requirements.consularPaid,
  appointment: (workflow) => workflow.requirements.appointmentScheduled,
  interview: (workflow) => workflow.requirements.interviewStarted,
};

function buildDetail(id, done, workflow) {
  const { requirements } = workflow;
  if (id === "documents") {
    return {
      key: "checklist.detail.documents",
      vars: {
        uploaded: Number(requirements.requiredDocumentsUploaded) || 0,
        approved: Number(requirements.requiredDocumentsApproved) || 0,
        total: Number(requirements.requiredDocuments) || 0,
      },
    };
  }
  if (id === "payment" && !done && requirements.paymentStarted) return { key: "checklist.detail.paymentInProgress", vars: {} };
  if (id === "assignment" && !done) return { key: "checklist.detail.assignmentPending", vars: {} };
  return null;
}

/**
 * Convierte la respuesta de GET /workflow/me en la lista de actividades hechas y pendientes.
 * Devuelve `null` si no hay información suficiente para decidir el estado de cada actividad.
 */
export function buildProcessChecklist(workflow) {
  if (!workflow || typeof workflow !== "object" || !workflow.requirements) return null;

  const items = CHECKLIST_ORDER.map((id) => {
    const done = Boolean(IS_DONE[id](workflow));
    const gate = workflow.gates?.[id];
    const locked = !done && gate?.allowed === false;
    const current = !done && workflow.currentStep === id;
    return {
      id,
      state: done ? "done" : current ? "current" : "pending",
      locked,
      blockedReason: locked ? String(gate.reason || "") : "",
      path: !done && !locked ? STEP_PATHS[id] : null,
      detail: buildDetail(id, done, workflow),
    };
  });

  const doneCount = items.filter((item) => item.state === "done").length;
  return {
    items,
    doneCount,
    total: items.length,
    allDone: doneCount === items.length,
    currentId: items.find((item) => item.state === "current")?.id ?? null,
  };
}

// Etapa del flujo real -> número de etapa de las acciones genéricas del dashboard.
const STAGE_BY_STEP = { profile: 1, ds160: 2, documents: 3, interview: 6 };

/**
 * "Siguiente acción" coherente con el checklist: sigue la etapa vigente del backend. Para
 * pago y cita usa sus pantallas propias; para el resto reutiliza la acción genérica de la
 * etapa. Devuelve `null` cuando no hay una acción propia (por ejemplo, esperando asesor) y
 * el dashboard conserva su comportamiento anterior.
 */
export function getWorkflowNextAction({ workflow, stageAction, t }) {
  if (!workflow?.requirements) return null;
  const step = workflow.currentStep;
  if (step === "payment" || step === "appointment") {
    return {
      priority: t("action.priorityHigh"),
      timeEstimate: t("action.timeEstimate", { min: step === "payment" ? 20 : 10 }),
      title: t(`action.${step}.title`),
      description: t(`action.${step}.description`),
      path: STEP_PATHS[step],
      buttonLabel: t(`action.${step}.button`),
    };
  }
  const stage = STAGE_BY_STEP[step];
  return stage ? stageAction(stage) : null;
}
