import { describe, expect, it, vi } from "vitest";
import { buildProcessChecklist, CHECKLIST_ORDER, getWorkflowNextAction } from "../utils/processChecklist";
import { workflowFixture } from "./helpers/workflowFixture";

const byId = (checklist, id) => checklist.items.find((item) => item.id === id);

describe("buildProcessChecklist", () => {
  it("devuelve null cuando no hay información suficiente para decidir los estados", () => {
    expect(buildProcessChecklist(null)).toBeNull();
    expect(buildProcessChecklist(undefined)).toBeNull();
    expect(buildProcessChecklist({})).toBeNull();
    expect(buildProcessChecklist({ assigned: true, gates: {} })).toBeNull();
  });

  it("lista las siete actividades del trámite en el orden real del flujo", () => {
    const checklist = buildProcessChecklist(workflowFixture("initial"));

    expect(checklist.items.map((item) => item.id)).toEqual(CHECKLIST_ORDER);
    expect(CHECKLIST_ORDER).toEqual(["profile", "assignment", "ds160", "documents", "payment", "appointment", "interview"]);
    expect(checklist.total).toBe(7);
  });

  it("avance inicial: nada completado y el perfil es el siguiente paso", () => {
    const checklist = buildProcessChecklist(workflowFixture("initial"));

    expect(checklist.doneCount).toBe(0);
    expect(checklist.allDone).toBe(false);
    expect(checklist.currentId).toBe("profile");
    expect(checklist.items.map((item) => item.state)).toEqual(
      ["current", "pending", "pending", "pending", "pending", "pending", "pending"]
    );
    expect(byId(checklist, "profile").path).toBe("/perfil");
  });

  it("las actividades bloqueadas por el backend muestran su motivo y no ofrecen acceso", () => {
    const checklist = buildProcessChecklist(workflowFixture("initial"));
    const ds160 = byId(checklist, "ds160");

    expect(ds160.locked).toBe(true);
    expect(ds160.blockedReason).toBe("Completa tu perfil antes de iniciar el DS-160.");
    expect(ds160.path).toBeNull();
    expect(byId(checklist, "payment").locked).toBe(true);
    expect(byId(checklist, "appointment").locked).toBe(true);
    expect(byId(checklist, "interview").locked).toBe(true);
    expect(byId(checklist, "profile").locked).toBe(false);
  });

  it("perfil completo sin asesor: el siguiente paso es esperar la asignación y no tiene acceso propio", () => {
    const checklist = buildProcessChecklist(workflowFixture("profileDone"));

    expect(byId(checklist, "profile").state).toBe("done");
    expect(byId(checklist, "assignment").state).toBe("current");
    expect(byId(checklist, "assignment").path).toBeNull();
    expect(byId(checklist, "assignment").detail.key).toBe("checklist.detail.assignmentPending");
    expect(checklist.doneCount).toBe(1);
  });

  it("avance parcial: completadas, siguiente paso y pendientes según los datos reales", () => {
    const checklist = buildProcessChecklist(workflowFixture("partial"));

    expect(checklist.items.map((item) => item.state)).toEqual(
      ["done", "done", "done", "current", "pending", "pending", "pending"]
    );
    expect(checklist.doneCount).toBe(3);
    expect(checklist.currentId).toBe("documents");
    expect(byId(checklist, "documents").path).toBe("/documents");
    expect(byId(checklist, "documents").detail).toEqual({
      key: "checklist.detail.documents",
      vars: { uploaded: 3, approved: 2, total: 3 },
    });
    expect(byId(checklist, "payment").locked).toBe(true);
    expect(byId(checklist, "payment").blockedReason).toContain("documentos obligatorios");
  });

  it("los documentos solo cuentan como completados cuando los tres están aprobados, no solo subidos", () => {
    const uploadedOnly = workflowFixture("partial", { requirements: { requiredDocumentsApproved: 0, documentsApproved: false } });
    const approved = workflowFixture("partial", { requirements: { requiredDocumentsApproved: 3, documentsApproved: true }, currentStep: "payment" });

    expect(byId(buildProcessChecklist(uploadedOnly), "documents").state).toBe("current");
    expect(byId(buildProcessChecklist(approved), "documents").state).toBe("done");
  });

  it("no marca una actividad como completada por su posición: una posterior puede estar hecha y una anterior no", () => {
    const checklist = buildProcessChecklist(workflowFixture("partial", {
      requirements: { ds160Complete: false, requiredDocumentsApproved: 3, documentsApproved: true },
      currentStep: "ds160",
    }));

    expect(byId(checklist, "ds160").state).toBe("current");
    expect(byId(checklist, "documents").state).toBe("done");
    expect(checklist.items.filter((item) => item.state === "current")).toHaveLength(1);
  });

  it("pago en gestión: sigue pendiente y explica que la transferencia está en validación", () => {
    const checklist = buildProcessChecklist(workflowFixture("payment"));
    const payment = byId(checklist, "payment");

    expect(payment.state).toBe("current");
    expect(payment.detail.key).toBe("checklist.detail.paymentInProgress");
    expect(payment.path).toBe("/pagos");
  });

  it("trámite completo: todo hecho, sin siguiente paso ni accesos pendientes", () => {
    const checklist = buildProcessChecklist(workflowFixture("complete"));

    expect(checklist.allDone).toBe(true);
    expect(checklist.doneCount).toBe(7);
    expect(checklist.currentId).toBeNull();
    expect(checklist.items.every((item) => item.state === "done" && item.path === null)).toBe(true);
  });

  it("al cambiar los datos del trámite el checklist refleja el avance", () => {
    const before = buildProcessChecklist(workflowFixture("partial"));
    const after = buildProcessChecklist(workflowFixture("partial", {
      requirements: { requiredDocumentsApproved: 3, documentsApproved: true },
      currentStep: "payment",
      gates: { payment: { allowed: true, reason: "", requiredStep: null, requiredPath: null } },
    }));

    expect(before.doneCount).toBe(3);
    expect(after.doneCount).toBe(4);
    expect(byId(after, "documents").state).toBe("done");
    expect(byId(after, "payment").state).toBe("current");
    expect(byId(after, "payment").locked).toBe(false);
  });
});

describe("getWorkflowNextAction", () => {
  const t = (key, vars) => `${key}${vars ? JSON.stringify(vars) : ""}`;
  const stageAction = vi.fn((stage) => ({ stage }));

  it("sigue la etapa vigente del backend: DS-160, documentos y entrevista reutilizan su acción genérica", () => {
    expect(getWorkflowNextAction({ workflow: workflowFixture("profileDone", { assigned: true, currentStep: "ds160" }), stageAction, t })).toEqual({ stage: 2 });
    expect(getWorkflowNextAction({ workflow: workflowFixture("partial"), stageAction, t })).toEqual({ stage: 3 });
    expect(getWorkflowNextAction({ workflow: workflowFixture("initial"), stageAction, t })).toEqual({ stage: 1 });
  });

  it("con la entrevista ya practicada deja de pedir prepararla y pasa a la acción de seguimiento", () => {
    const interviewPending = workflowFixture("complete", { requirements: { interviewStarted: false } });

    expect(getWorkflowNextAction({ workflow: interviewPending, stageAction, t })).toEqual({ stage: 6 });
    expect(getWorkflowNextAction({ workflow: workflowFixture("complete"), stageAction, t })).toEqual({ stage: 7 });
  });

  it("pago y cita llevan a sus pantallas propias en lugar de WhatsApp", () => {
    const payment = getWorkflowNextAction({ workflow: workflowFixture("payment"), stageAction, t });
    const appointment = getWorkflowNextAction({ workflow: workflowFixture("payment", { currentStep: "appointment" }), stageAction, t });

    expect(payment.path).toBe("/pagos");
    expect(payment.title).toBe("action.payment.title");
    expect(appointment.path).toBe("/citas");
    expect(appointment.buttonLabel).toBe("action.appointment.button");
  });

  it("devuelve null cuando no hay acción propia (esperando asesor) o falta información", () => {
    expect(getWorkflowNextAction({ workflow: workflowFixture("profileDone"), stageAction, t })).toBeNull();
    expect(getWorkflowNextAction({ workflow: null, stageAction, t })).toBeNull();
    expect(getWorkflowNextAction({ workflow: {}, stageAction, t })).toBeNull();
  });
});
