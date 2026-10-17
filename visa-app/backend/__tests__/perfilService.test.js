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
      "UPDATE usuario SET perfil = $1 WHERE id_usuario = $2 RETURNING *",
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
});
