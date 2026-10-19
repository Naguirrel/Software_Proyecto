const request = require("supertest");
const { createConsularAppointmentsIntegrationApp } = require("../test-utils/consularAppointmentsIntegrationHarness");

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days) => new Date(Date.now() + days * DAY_MS).toISOString();

describe("integración: módulo de citas consulares", () => {
  let ctx;
  let client;
  let advisor;
  let otherAdvisor;
  let admin;

  const putAppointment = (token, userId = client.user.id_usuario) =>
    request(ctx.app).put(`/staff/consular-cases/${userId}/appointment`).set("Authorization", `Bearer ${token}`);
  const cancelAppointment = (token, appointmentId, userId = client.user.id_usuario) =>
    request(ctx.app).post(`/staff/consular-cases/${userId}/appointments/${appointmentId}/cancel`).set("Authorization", `Bearer ${token}`);
  const myAppointments = (token) =>
    request(ctx.app).get("/appointments/me").set("Authorization", `Bearer ${token}`);
  const validBody = (overrides = {}) => ({ appointmentAt: inDays(30), confirmationCode: "AA00BB11", ...overrides });

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    ctx = createConsularAppointmentsIntegrationApp();
    client = ctx.addUser({ id: 1, nombre: "Ana Cliente" });
    advisor = ctx.addUser({ id: 2, rol: "asesor", nombre: "Asesor Asignado" });
    otherAdvisor = ctx.addUser({ id: 3, rol: "asesor", nombre: "Otro Asesor" });
    admin = ctx.addUser({ id: 4, rol: "admin", nombre: "Admin" });
    ctx.addTramite({ userId: 1, advisorId: 2, progreso: 51 });
    ctx.addConsularPayment(1, "consular_paid");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("un cliente sin cita registrada recibe una lista vacía", async () => {
    const response = await myAppointments(client.token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ appointments: [] });
  });

  test("el asesor asignado registra la cita oficial y el cliente la ve con sus acercamientos disponibles", async () => {
    const appointmentAt = inDays(30);

    const saved = await putAppointment(advisor.token).send(validBody({ appointmentAt, consulate: "Embajada de EE. UU.", notes: "Llevar pasaporte" }));
    expect(saved.status).toBe(200);
    expect(saved.body.appointment).toMatchObject({ consulate: "Embajada de EE. UU.", status: "scheduled", confirmation_code: "AA00BB11",
      reschedule_count: 0, remaining_reschedules: 2, notes: "Llevar pasaporte" });

    const listed = await myAppointments(client.token);
    expect(listed.body.appointments).toHaveLength(1);
    expect(listed.body.appointments[0]).toMatchObject({ confirmation_code: "AA00BB11", remaining_reschedules: 2 });
    expect(new Date(listed.body.appointments[0].appointment_at).toISOString()).toBe(appointmentAt);
  });

  test("usa la embajada de Guatemala por defecto cuando no se indica consulado", async () => {
    const saved = await putAppointment(advisor.token).send(validBody());

    expect(saved.body.appointment.consulate).toBe("Embajada de Estados Unidos, Ciudad de Guatemala");
  });

  test("registrar la cita avanza el trámite a la etapa de entrevista y notifica al cliente", async () => {
    await putAppointment(advisor.token).send(validBody());

    expect(ctx.findTramite(1)).toMatchObject({ etapa_actual: "Entrevista", progreso: 67 });
    expect(ctx.notificaciones).toHaveLength(1);
    expect(ctx.notificaciones[0]).toMatchObject({ userId: 1, titulo: "Cita consular registrada", tipo: "entrevista", prioridad: "normal" });
  });

  test("rechaza registrar la cita si el pago consular aún no está confirmado", async () => {
    ctx.state.payments[0].status = "consular_processing";

    const response = await putAppointment(advisor.token).send(validBody());

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/pago realizado ante el consulado/);
    expect(ctx.state.appointments).toHaveLength(0);
  });

  test("exige el número de confirmación oficial", async () => {
    const missing = await putAppointment(advisor.token).send({ appointmentAt: inDays(30) });
    const blank = await putAppointment(advisor.token).send(validBody({ confirmationCode: "   " }));

    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(ctx.state.appointments).toHaveLength(0);
  });

  test("rechaza fechas inválidas, ausentes o ya pasadas", async () => {
    const invalid = await putAppointment(advisor.token).send(validBody({ appointmentAt: "no-es-una-fecha" }));
    const missing = await putAppointment(advisor.token).send({ confirmationCode: "AA00BB11" });
    const past = await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(-1) }));

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(past.status).toBe(400);
    expect(past.body.error).toMatch(/fecha futura/);
    expect(ctx.state.appointments).toHaveLength(0);
  });

  test("rechaza un identificador de cliente inválido", async () => {
    const response = await putAppointment(advisor.token, "abc").send(validBody());

    expect(response.status).toBe(400);
  });

  test("un acercamiento mueve la cita a una fecha anterior, consume un cupo y notifica", async () => {
    await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(30) }));
    ctx.notificaciones.length = 0;
    const earlier = inDays(20);

    const response = await putAppointment(advisor.token).send(validBody({ appointmentAt: earlier }));

    expect(response.status).toBe(200);
    expect(response.body.appointment).toMatchObject({ reschedule_count: 1, remaining_reschedules: 1 });
    expect(new Date(response.body.appointment.appointment_at).toISOString()).toBe(earlier);
    expect(ctx.state.appointments).toHaveLength(1);
    expect(ctx.notificaciones[0]).toMatchObject({ titulo: "Cita consular acercada", prioridad: "alta" });
  });

  test("rechaza mover la cita a una fecha posterior", async () => {
    await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(30) }));

    const response = await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(45) }));

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/fecha anterior/);
    expect(ctx.state.appointments[0].reschedule_count).toBe(0);
  });

  test("solo permite dos acercamientos: el tercero responde 409", async () => {
    await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(30) }));
    await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(25) }));
    await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(20) }));

    const third = await putAppointment(advisor.token).send(validBody({ appointmentAt: inDays(15) }));

    expect(third.status).toBe(409);
    expect(third.body.error).toMatch(/2 acercamientos/);
    expect(ctx.state.appointments[0].reschedule_count).toBe(2);
    const listed = await myAppointments(client.token);
    expect(listed.body.appointments[0].remaining_reschedules).toBe(0);
  });

  test("corregir los datos sin cambiar la fecha no consume acercamientos", async () => {
    const appointmentAt = inDays(30);
    await putAppointment(advisor.token).send(validBody({ appointmentAt }));

    const response = await putAppointment(advisor.token).send(validBody({ appointmentAt, confirmationCode: "CC22DD33", notes: "Corregido" }));

    expect(response.status).toBe(200);
    expect(response.body.appointment).toMatchObject({ confirmation_code: "CC22DD33", notes: "Corregido", reschedule_count: 0, remaining_reschedules: 2 });
    expect(ctx.state.appointments).toHaveLength(1);
  });

  test("no permite reutilizar un número de confirmación de otro cliente", async () => {
    const second = ctx.addUser({ id: 5, nombre: "Luis Cliente" });
    ctx.addTramite({ userId: 5, advisorId: 2, progreso: 51 });
    ctx.addConsularPayment(5, "consular_paid");
    await putAppointment(advisor.token).send(validBody({ confirmationCode: "REPETIDO-1" }));

    const duplicate = await putAppointment(advisor.token, second.user.id_usuario).send(validBody({ confirmationCode: "REPETIDO-1" }));

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatch(/ya está registrado/);
    expect(ctx.state.appointments).toHaveLength(1);
  });

  test("cancelar la cita la marca como cancelada, notifica al cliente y permite registrar una nueva", async () => {
    const saved = await putAppointment(advisor.token).send(validBody({ confirmationCode: "PRIMERA-1" }));
    ctx.notificaciones.length = 0;

    const cancelled = await cancelAppointment(advisor.token, saved.body.appointment.id);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.appointment.status).toBe("cancelled");
    expect(ctx.notificaciones[0]).toMatchObject({ titulo: "Cita consular cancelada", prioridad: "alta" });

    const replacement = await putAppointment(advisor.token).send(validBody({ confirmationCode: "SEGUNDA-2", appointmentAt: inDays(40) }));
    expect(replacement.status).toBe(200);
    const listed = await myAppointments(client.token);
    expect(listed.body.appointments.map((item) => item.status).sort()).toEqual(["cancelled", "scheduled"]);
  });

  test("cancelar una cita inexistente o ya cancelada responde 404 y datos inválidos 400", async () => {
    const saved = await putAppointment(advisor.token).send(validBody());
    await cancelAppointment(advisor.token, saved.body.appointment.id);

    const alreadyCancelled = await cancelAppointment(advisor.token, saved.body.appointment.id);
    const missing = await cancelAppointment(advisor.token, 999);
    const invalid = await cancelAppointment(advisor.token, "abc");

    expect(alreadyCancelled.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });

  test("un asesor que no tiene asignado el expediente no puede registrar ni cancelar citas", async () => {
    const saved = await putAppointment(advisor.token).send(validBody());

    const register = await putAppointment(otherAdvisor.token).send(validBody({ confirmationCode: "OTRO-1" }));
    const cancel = await cancelAppointment(otherAdvisor.token, saved.body.appointment.id);

    expect(register.status).toBe(403);
    expect(cancel.status).toBe(403);
    expect(ctx.state.appointments[0].status).toBe("scheduled");
  });

  test("un administrador puede gestionar la cita de cualquier cliente", async () => {
    const saved = await putAppointment(admin.token).send(validBody());
    const cancelled = await cancelAppointment(admin.token, saved.body.appointment.id);

    expect(saved.status).toBe(200);
    expect(cancelled.status).toBe(200);
  });

  test("un cliente no puede registrar ni cancelar citas y sin sesión se responde 401", async () => {
    const asClient = await putAppointment(client.token).send(validBody());
    const cancelAsClient = await cancelAppointment(client.token, 1);
    const withoutSession = await request(ctx.app).put("/staff/consular-cases/1/appointment").send(validBody());
    const listWithoutSession = await request(ctx.app).get("/appointments/me");

    expect(asClient.status).toBe(403);
    expect(cancelAsClient.status).toBe(403);
    expect(withoutSession.status).toBe(401);
    expect(listWithoutSession.status).toBe(401);
    expect(ctx.state.appointments).toHaveLength(0);
  });

  test("cada cliente solo ve sus propias citas", async () => {
    const second = ctx.addUser({ id: 5, nombre: "Luis Cliente" });
    ctx.addTramite({ userId: 5, advisorId: 2, progreso: 51 });
    ctx.addConsularPayment(5, "consular_paid");
    await putAppointment(advisor.token).send(validBody({ confirmationCode: "ANA-1" }));
    await putAppointment(advisor.token, 5).send(validBody({ confirmationCode: "LUIS-1" }));

    const anaView = await myAppointments(client.token);
    const luisView = await myAppointments(second.token);

    expect(anaView.body.appointments.map((item) => item.confirmation_code)).toEqual(["ANA-1"]);
    expect(luisView.body.appointments.map((item) => item.confirmation_code)).toEqual(["LUIS-1"]);
  });

  test("si falla el envío de la notificación, la cita igual queda registrada", async () => {
    ctx.notificacionService.crearNotificacion.mockRejectedValueOnce(new Error("notificaciones caídas"));

    const response = await putAppointment(advisor.token).send(validBody());

    expect(response.status).toBe(200);
    expect(ctx.state.appointments).toHaveLength(1);
  });
});
