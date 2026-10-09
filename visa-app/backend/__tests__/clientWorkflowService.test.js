const { createClientWorkflowService } = require("../services/clientWorkflowService");

function buildRow(overrides = {}) {
  return {
    id_usuario: 5,
    perfil: "Turismo",
    id_tramite: 20,
    id_asesor: null,
    estado: "En proceso",
    etapa_actual: "Asignación de asesor",
    progreso: 10,
    ds160_complete: false,
    required_documents_uploaded: 0,
    required_documents_approved: 0,
    payment_started: false,
    consular_paid: false,
    appointment_scheduled: false,
    interview_started: false,
    ...overrides,
  };
}

function createService(row) {
  return createClientWorkflowService({
    query: jest.fn(async () => ({ rows: row ? [row] : [] })),
  });
}

describe("clientWorkflowService", () => {
  test("sin asesor mantiene disponibles solo las funciones autónomas", async () => {
    const workflow = await createService(buildRow()).getWorkflow(5);

    expect(workflow).toMatchObject({ assigned: false, currentStep: "assignment" });
    expect(workflow.gates.profile.allowed).toBe(true);
    expect(workflow.gates.documents.allowed).toBe(true);
    expect(workflow.gates.dashboard.allowed).toBe(true);
    expect(workflow.gates.chat).toMatchObject({
      allowed: false,
      requiredStep: "assignment",
      requiredPath: "/dashboard",
    });
    expect(workflow.gates.ds160.allowed).toBe(false);
    expect(workflow.gates.payment.allowed).toBe(false);
    expect(workflow.gates.appointment.allowed).toBe(false);
    expect(workflow.gates.interview.allowed).toBe(false);
  });

  test("bloquea el pago hasta completar DS-160 y aprobar los documentos requeridos", async () => {
    const service = createService(buildRow({ id_asesor: 9, ds160_complete: true, required_documents_uploaded: 3 }));

    await expect(service.assertStep(5, "payment")).rejects.toMatchObject({
      statusCode: 409,
      code: "WORKFLOW_STEP_LOCKED",
      requiredStep: "documents",
      requiredPath: "/documents",
    });
  });

  test("habilita cada etapa únicamente después de cumplir sus dependencias", async () => {
    const workflow = await createService(buildRow({
      id_asesor: 9,
      ds160_complete: true,
      required_documents_uploaded: 3,
      required_documents_approved: 3,
      payment_started: true,
      consular_paid: true,
      appointment_scheduled: true,
    })).getWorkflow(5);

    expect(workflow.gates).toMatchObject({
      chat: { allowed: true },
      ds160: { allowed: true },
      payment: { allowed: true },
      appointment: { allowed: true },
      interview: { allowed: true },
    });
    expect(workflow.currentStep).toBe("interview");
  });

  test("exige completar el perfil incluso cuando ya existe una asignación", async () => {
    const workflow = await createService(buildRow({ perfil: null, id_asesor: 9 })).getWorkflow(5);

    expect(workflow.currentStep).toBe("profile");
    expect(workflow.gates.ds160).toMatchObject({
      allowed: false,
      requiredStep: "profile",
      requiredPath: "/perfil",
    });
  });

  test("rechaza usuarios inválidos o inexistentes", async () => {
    await expect(createService(buildRow()).getWorkflow("invalid")).rejects.toMatchObject({ statusCode: 400 });
    await expect(createService(null).getWorkflow(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});
