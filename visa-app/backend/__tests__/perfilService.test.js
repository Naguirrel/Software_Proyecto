const createPerfilService = require("../services/perfilService");

function createService(queryImplementation = async () => ({ rows: [] })) {
  const pool = { query: jest.fn(queryImplementation) };
  const service = createPerfilService(pool, {
    userSchemaReady: Promise.resolve(),
    tramiteSchemaReady: Promise.resolve(),
  });
  return { pool, service };
}

describe("perfilService limita operaciones al usuario autenticado", () => {
  afterEach(() => jest.useRealTimers());
  test("consulta el perfil por id_usuario", async () => {
    const user = { id_usuario: 7, correo: "ana@example.com" };
    const { pool, service } = createService(async () => ({ rows: [user] }));

    await expect(service.findUserById(7)).resolves.toEqual(user);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM usuario WHERE id_usuario = $1"),
      [7]
    );
  });

  test("guarda la selección de perfil por id_usuario y no por correo", async () => {
    const { pool, service } = createService(async () => ({ rows: [{ id_usuario: 7, perfil: "estudiante" }] }));

    await service.guardarPerfil(7, "estudiante");

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET perfil = \$1::varchar[\s\S]+perfil IS DISTINCT FROM \$1::varchar/),
      ["estudiante", 7]
    );
  });

  test("actualiza los datos personales usando id_usuario como límite", async () => {
    const { pool, service } = createService(async () => ({ rows: [{ id_usuario: 7, nombre: "Ana" }] }));

    await service.updateUsuarioPerfil(7, { nombre: "Ana", ciudad: "Guatemala" });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id_usuario = \$3/),
      ["Ana", "Guatemala", 7]
    );
  });

  test("evalúa renovación solo cuando la visa anterior ya venció dentro de los últimos doce meses", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
    const { service } = createService(async (sql, values) => {
      if (String(sql).startsWith("SELECT perfil")) return { rows: [{ perfil: "renovacion" }] };
      if (String(sql).startsWith("UPDATE usuario SET visa_details")) {
        return { rows: [{ visa_details: JSON.parse(values[0]) }] };
      }
      return { rows: [] };
    });
    const base = {
      priorVisaClass: "B1/B2",
      priorVisaFullValidity: true,
      issuedAtAgeEighteenOrOlder: true,
      refusalStatus: "none",
      hasPotentialIneligibility: false,
    };

    const eligible = await service.updateVisaDetails(7, { ...base, priorVisaExpirationDate: "2026-05-10" });
    const notExpired = await service.updateVisaDetails(7, { ...base, priorVisaExpirationDate: "2026-12-10" });

    expect(eligible.renewalEligibility.potentiallyEligible).toBe(true);
    expect(notExpired.renewalEligibility.potentiallyEligible).toBe(false);
  });

  test("rechaza guardar evaluación de renovación en otro perfil", async () => {
    const { service } = createService(async (sql) => (
      String(sql).startsWith("SELECT perfil")
        ? { rows: [{ perfil: "estudiante" }] }
        : { rows: [] }
    ));

    await expect(service.updateVisaDetails(7, {})).rejects.toMatchObject({ statusCode: 409 });
  });
});
