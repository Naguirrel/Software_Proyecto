const AVATAR_SIZE_LIMIT_BYTES = 2 * 1024 * 1024;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function positiveId(value, label = "Usuario") {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw httpError(`${label} inválido`, 400);
  return parsed;
}

function validateAvatarFile(file) {
  if (!file?.buffer?.length) throw httpError("Selecciona una fotografía", 400);
  if (file.size > AVATAR_SIZE_LIMIT_BYTES) {
    throw httpError("La fotografía no puede superar 2 MB", 413);
  }

  const bytes = file.buffer;
  if (!new Set(["image/jpeg", "image/png"]).has(file.mimetype)) {
    throw httpError("La fotografía debe ser un archivo JPG o PNG", 400);
  }
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if ((file.mimetype === "image/jpeg" && !isJpeg) || (file.mimetype === "image/png" && !isPng)) {
    throw httpError("El contenido del archivo no corresponde a una imagen JPG o PNG válida", 400);
  }
}

async function withTransaction(pool, callback) {
  const client = typeof pool.connect === "function" ? await pool.connect() : pool;
  try {
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (rollbackError) {
      console.error("AVATAR ROLLBACK ERROR:", rollbackError);
    }
    throw error;
  } finally {
    client.release?.();
  }
}

function avatarVersion(row) {
  return row?.avatar_updated_at ? new Date(row.avatar_updated_at).getTime() : null;
}

function createProfileIdentityService(pool, {
  schemaReady = Promise.resolve(),
  uploadStoredFile,
  deleteStoredFile,
  getStoredFile,
} = {}) {
  async function canViewUser(viewer, targetUserId) {
    const viewerId = positiveId(viewer?.id_usuario, "Sesión");
    const targetId = positiveId(targetUserId);
    if (viewerId === targetId || viewer?.rol === "admin") return true;

    const result = await pool.query(
      `SELECT 1
       FROM tramite
       WHERE (id_usuario = $1 AND id_asesor = $2 AND $3 = 'cliente')
          OR (id_usuario = $2 AND id_asesor = $1 AND $3 = 'asesor')
       LIMIT 1`,
      [viewerId, targetId, viewer?.rol]
    );
    return result.rows.length > 0;
  }

  async function getAvatar(viewer, targetUserId) {
    await schemaReady;
    const targetId = positiveId(targetUserId);
    if (!(await canViewUser(viewer, targetId))) throw httpError("No tienes permiso para ver esta fotografía", 403);
    const result = await pool.query(
      `SELECT avatar_storage_key, avatar_mime_type, avatar_updated_at
       FROM usuario WHERE id_usuario = $1`,
      [targetId]
    );
    if (!result.rows.length) throw httpError("Usuario no encontrado", 404);
    const avatar = result.rows[0];
    if (!avatar.avatar_storage_key) throw httpError("Fotografía no registrada", 404);
    const stored = await getStoredFile(avatar.avatar_storage_key);
    return {
      ...stored,
      contentType: avatar.avatar_mime_type || stored.contentType || "application/octet-stream",
      version: avatarVersion(avatar),
    };
  }

  async function updateAvatar(userId, file, { baseUrl }) {
    await schemaReady;
    const parsedUserId = positiveId(userId);
    validateAvatarFile(file);
    const uploaded = await uploadStoredFile(file, { baseUrl });
    try {
      const { previousKey, row } = await withTransaction(pool, async (client) => {
        const current = await client.query(
          "SELECT avatar_storage_key FROM usuario WHERE id_usuario = $1 FOR UPDATE",
          [parsedUserId]
        );
        if (!current.rows.length) throw httpError("Usuario no encontrado", 404);
        const result = await client.query(
          `UPDATE usuario
           SET avatar_storage_key = $1, avatar_mime_type = $2,
               avatar_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id_usuario = $3
           RETURNING id_usuario, avatar_updated_at`,
          [uploaded.key, file.mimetype, parsedUserId]
        );
        return { previousKey: current.rows[0].avatar_storage_key, row: result.rows[0] };
      });
      if (previousKey && previousKey !== uploaded.key) {
        deleteStoredFile(previousKey).catch((error) => console.error("AVATAR CLEANUP ERROR:", error));
      }
      return { userId: parsedUserId, avatarVersion: avatarVersion(row) };
    } catch (error) {
      await deleteStoredFile(uploaded.key).catch(() => {});
      throw error;
    }
  }

  async function deleteAvatar(userId) {
    await schemaReady;
    const parsedUserId = positiveId(userId);
    const { previousKey, row } = await withTransaction(pool, async (client) => {
      const current = await client.query(
        "SELECT avatar_storage_key FROM usuario WHERE id_usuario = $1 FOR UPDATE",
        [parsedUserId]
      );
      if (!current.rows.length) throw httpError("Usuario no encontrado", 404);
      const result = await client.query(
        `UPDATE usuario
         SET avatar_storage_key = NULL, avatar_mime_type = NULL,
             avatar_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id_usuario = $1
         RETURNING avatar_updated_at`,
        [parsedUserId]
      );
      return { previousKey: current.rows[0].avatar_storage_key, row: result.rows[0] };
    });
    if (previousKey) {
      deleteStoredFile(previousKey).catch((error) => console.error("AVATAR DELETE ERROR:", error));
    }
    return { userId: parsedUserId, avatarVersion: avatarVersion(row) };
  }

  return { deleteAvatar, getAvatar, updateAvatar };
}

module.exports = { AVATAR_SIZE_LIMIT_BYTES, createProfileIdentityService, validateAvatarFile };
