const REQUIRED_DOCUMENT_KEYS = ["passport", "photo", "intake-form"];

const STEP_DEFINITIONS = {
  profile: { label: "Completar perfil", path: "/perfil" },
  assignment: { label: "Esperar asignación de asesor", path: "/dashboard" },
  documents: { label: "Subir documentos", path: "/documents" },
  ds160: { label: "Completar DS-160", path: "/ds160" },
  payment: { label: "Registrar pago", path: "/pagos" },
  appointment: { label: "Consultar cita consular", path: "/citas" },
  interview: { label: "Preparar entrevista", path: "/entrevista" },
};

function workflowError(message, requiredStep, requiredPath) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "WORKFLOW_STEP_LOCKED";
  error.requiredStep = requiredStep;
  error.requiredPath = requiredPath;
  return error;
}

function gate(allowed, reason = "", requiredStep = null) {
  return {
    allowed,
    reason: allowed ? "" : reason,
    requiredStep: allowed ? null : requiredStep,
    requiredPath: allowed || !requiredStep ? null : STEP_DEFINITIONS[requiredStep]?.path || "/dashboard",
  };
}

function createClientWorkflowService(pool) {
  async function getWorkflow(userId) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      const error = new Error("Usuario inválido");
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `SELECT u.id_usuario, u.perfil,
              t.id_tramite, t.id_asesor, t.estado, t.etapa_actual, t.progreso,
              EXISTS (
                SELECT 1 FROM formulario_ds160 f
                WHERE f.id_usuario = u.id_usuario AND f.completado = TRUE
              ) AS ds160_complete,
              COUNT(DISTINCT d.documento_key) FILTER (
                WHERE d.documento_key = ANY($2::varchar[])
              )::int AS required_documents_uploaded,
              COUNT(DISTINCT d.documento_key) FILTER (
                WHERE d.documento_key = ANY($2::varchar[]) AND d.estado = 'approved'
              )::int AS required_documents_approved,
              EXISTS (
                SELECT 1 FROM consular_payments p
                WHERE p.user_id = u.id_usuario
                  AND p.status IN ('transfer_pending','client_paid','consular_processing','consular_paid')
              ) AS payment_started,
              EXISTS (
                SELECT 1 FROM consular_payments p
                WHERE p.user_id = u.id_usuario AND p.status = 'consular_paid'
              ) AS consular_paid,
              EXISTS (
                SELECT 1 FROM consular_appointments a
                WHERE a.user_id = u.id_usuario AND a.status = 'scheduled'
              ) AS appointment_scheduled,
              EXISTS (
                SELECT 1 FROM interview_sessions i WHERE i.user_id = u.id_usuario
              ) AS interview_started
       FROM usuario u
       LEFT JOIN tramite t ON t.id_usuario = u.id_usuario
       LEFT JOIN documentos d ON d.usuario_id = u.id_usuario
       WHERE u.id_usuario = $1
       GROUP BY u.id_usuario, u.perfil, t.id_tramite, t.id_asesor, t.estado, t.etapa_actual, t.progreso`,
      [parsedUserId, REQUIRED_DOCUMENT_KEYS]
    );

    const row = result.rows[0];
    if (!row) {
      const error = new Error("Usuario no encontrado");
      error.statusCode = 404;
      throw error;
    }

    const profileComplete = Boolean(row.perfil);
    const assigned = Boolean(row.id_asesor);
    const ds160Complete = Boolean(row.ds160_complete);
    const requiredDocumentsUploaded = Number(row.required_documents_uploaded) || 0;
    const requiredDocumentsApproved = Number(row.required_documents_approved) || 0;
    const documentsUploaded = requiredDocumentsUploaded === REQUIRED_DOCUMENT_KEYS.length;
    const documentsApproved = requiredDocumentsApproved === REQUIRED_DOCUMENT_KEYS.length;
    const paymentStarted = Boolean(row.payment_started);
    const consularPaid = Boolean(row.consular_paid);
    const appointmentScheduled = Boolean(row.appointment_scheduled);
    const interviewStarted = Boolean(row.interview_started);

    const gates = {
      profile: gate(true),
      documents: gate(true),
      dashboard: gate(true),
      timeline: gate(true),
      notifications: gate(true),
      information: gate(true),
      chat: assigned
        ? gate(true)
        : gate(false, "El chat se habilitará cuando un administrador asigne tu asesor.", "assignment"),
      ds160: !profileComplete
        ? gate(false, "Completa tu perfil antes de iniciar el DS-160.", "profile")
        : assigned
          ? gate(true)
          : gate(false, "Necesitas un asesor asignado antes de iniciar el DS-160.", "assignment"),
      payment: !assigned
        ? gate(false, "Necesitas un asesor asignado antes de continuar con el pago.", "assignment")
        : !ds160Complete
          ? gate(false, "Completa el DS-160 antes de registrar el pago.", "ds160")
          : !documentsApproved
            ? gate(false, "Los tres documentos obligatorios deben estar aprobados antes del pago.", "documents")
            : gate(true),
      appointment: !consularPaid
        ? gate(false, "El pago consular debe estar confirmado antes de programar la cita.", "payment")
        : gate(true),
      interview: !appointmentScheduled
        ? gate(false, "Necesitas una cita consular activa antes de iniciar la preparación de entrevista.", "appointment")
        : gate(true),
    };

    let currentStep = "profile";
    if (profileComplete) currentStep = assigned ? "ds160" : "assignment";
    if (assigned && ds160Complete) currentStep = documentsApproved ? "payment" : "documents";
    if (paymentStarted) currentStep = consularPaid ? "appointment" : "payment";
    if (appointmentScheduled) currentStep = "interview";
    if (interviewStarted) currentStep = "interview";

    return {
      assigned,
      advisorId: row.id_asesor || null,
      currentStep,
      currentStepLabel: STEP_DEFINITIONS[currentStep]?.label || "Continuar trámite",
      process: row.id_tramite
        ? {
            id: row.id_tramite,
            state: row.estado,
            stage: row.etapa_actual,
            progress: Number(row.progreso) || 0,
          }
        : null,
      requirements: {
        profileComplete,
        ds160Complete,
        requiredDocuments: REQUIRED_DOCUMENT_KEYS.length,
        requiredDocumentsUploaded,
        requiredDocumentsApproved,
        documentsUploaded,
        documentsApproved,
        paymentStarted,
        consularPaid,
        appointmentScheduled,
        interviewStarted,
      },
      gates,
    };
  }

  async function assertStep(userId, step) {
    const workflow = await getWorkflow(userId);
    const stepGate = workflow.gates[step];
    if (!stepGate) {
      const error = new Error("Etapa de flujo inválida");
      error.statusCode = 500;
      throw error;
    }
    if (!stepGate.allowed) {
      throw workflowError(stepGate.reason, stepGate.requiredStep, stepGate.requiredPath);
    }
    return workflow;
  }

  return { assertStep, getWorkflow };
}

module.exports = { REQUIRED_DOCUMENT_KEYS, createClientWorkflowService };
