const {
  AVATAR_SIZE_LIMIT_BYTES,
  createProfileIdentityService,
  validateAvatarFile,
} = require("../services/profileIdentityService");

function jpegFile(overrides = {}) {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
  return {
    buffer,
    mimetype: "image/jpeg",
    originalname: "perfil.jpg",
    size: buffer.length,
    ...overrides,
  };
}

describe("profileIdentityService", () => {
  test("valida tipo, contenido y tamaño de la fotografía", () => {
    expect(() => validateAvatarFile(jpegFile())).not.toThrow();
    expect(() => validateAvatarFile(jpegFile({ mimetype: "image/gif" })))
      .toThrow("JPG o PNG");
    expect(() => validateAvatarFile(jpegFile({ buffer: Buffer.from("not-an-image") })))
      .toThrow("no corresponde");
    expect(() => validateAvatarFile(jpegFile({ size: AVATAR_SIZE_LIMIT_BYTES + 1 })))
      .toThrow("2 MB");
  });

  test("impide consultar el avatar de un usuario sin relación", async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const getStoredFile = jest.fn();
    const service = createProfileIdentityService(pool, { getStoredFile });

    await expect(service.getAvatar({ id_usuario: 7, rol: "cliente" }, 12))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(getStoredFile).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM tramite"), [7, 12, "cliente"]);
  });

  test("reemplaza el avatar bajo bloqueo y elimina el archivo anterior", async () => {
    const statements = [];
    const client = {
      query: jest.fn(async (sql) => {
        const normalized = String(sql).replace(/\s+/g, " ").trim();
        statements.push(normalized);
        if (normalized.startsWith("SELECT avatar_storage_key") && normalized.includes("FOR UPDATE")) {
          return { rows: [{ avatar_storage_key: "avatars/old.jpg" }] };
        }
        if (normalized.startsWith("UPDATE usuario")) {
          return { rows: [{ id_usuario: 7, avatar_updated_at: new Date("2026-10-24T12:00:00Z") }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client) };
    const uploadStoredFile = jest.fn().mockResolvedValue({ key: "avatars/new.jpg" });
    const deleteStoredFile = jest.fn().mockResolvedValue(undefined);
    const service = createProfileIdentityService(pool, { uploadStoredFile, deleteStoredFile });

    await expect(service.updateAvatar(7, jpegFile(), { baseUrl: "http://localhost" })).resolves.toEqual({
      userId: 7,
      avatarVersion: new Date("2026-10-24T12:00:00Z").getTime(),
    });

    expect(statements[0]).toBe("BEGIN");
    expect(statements).toContain("COMMIT");
    expect(statements.some((sql) => sql.includes("FOR UPDATE"))).toBe(true);
    expect(deleteStoredFile).toHaveBeenCalledWith("avatars/old.jpg");
    expect(client.release).toHaveBeenCalled();
  });

  test("revierte la transacción y limpia el archivo nuevo si el usuario no existe", async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes("SELECT avatar_storage_key")) return { rows: [] };
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const deleteStoredFile = jest.fn().mockResolvedValue(undefined);
    const service = createProfileIdentityService(
      { connect: jest.fn().mockResolvedValue(client) },
      {
        uploadStoredFile: jest.fn().mockResolvedValue({ key: "avatars/orphan.jpg" }),
        deleteStoredFile,
      }
    );

    await expect(service.updateAvatar(99, jpegFile(), { baseUrl: "http://localhost" }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(deleteStoredFile).toHaveBeenCalledWith("avatars/orphan.jpg");
  });
});
