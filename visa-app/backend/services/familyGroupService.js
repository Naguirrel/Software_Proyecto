const { normalizeProfileKey } = require("../config/visaProfiles");

const RELATIONSHIPS = new Set([
  "conyuge",
  "hijo_hija",
  "padre_madre",
  "hermano_hermana",
  "otro",
]);
const MAX_FAMILY_MEMBERS = 15;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePositiveId(value, label = "Integrante") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(`${label} inválido`, 400);
  return id;
}

function normalizeMemberPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || payload.fullName !== undefined) {
    const fullName = String(payload.fullName || "").trim().replace(/\s+/g, " ");
    if (fullName.length < 3 || fullName.length > 160) {
      throw httpError("El nombre completo debe tener entre 3 y 160 caracteres", 400);
    }
    data.fullName = fullName;
  }

  if (!partial || payload.relationship !== undefined) {
    const relationship = String(payload.relationship || "").trim();
    if (!RELATIONSHIPS.has(relationship)) throw httpError("Parentesco inválido", 400);
    data.relationship = relationship;
  }

  if (!partial || payload.dateOfBirth !== undefined) {
    const dateOfBirth = String(payload.dateOfBirth || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      throw httpError("La fecha de nacimiento debe usar el formato AAAA-MM-DD", 400);
    }
    const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
      throw httpError("La fecha de nacimiento no es válida", 400);
    }
    data.dateOfBirth = dateOfBirth;
  }

  if (payload.ds160ConfirmationNumber !== undefined) {
    const confirmation = String(payload.ds160ConfirmationNumber || "").trim().toUpperCase();
    if (confirmation && !/^AA[0-9A-Z]{6,14}$/.test(confirmation)) {
      throw httpError("La confirmación DS-160 debe comenzar con AA y contener únicamente letras o números", 400);
    }
    data.ds160ConfirmationNumber = confirmation || null;
  }

  return data;
}

function presentMember(row) {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    relationship: row.relationship,
    dateOfBirth: row.date_of_birth instanceof Date
      ? row.date_of_birth.toISOString().slice(0, 10)
      : String(row.date_of_birth).slice(0, 10),
    ds160ConfirmationNumber: row.ds160_confirmation_number || "",
    ds160Complete: Boolean(row.ds160_confirmation_number),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createFamilyGroupService(pool, { schemaReady = Promise.resolve() } = {}) {
  async function ensureGroupProfile(userId) {
    await schemaReady;
    const result = await pool.query("SELECT perfil FROM usuario WHERE id_usuario=$1", [userId]);
    if (!result.rows.length) throw httpError("Usuario no encontrado", 404);
    if (normalizeProfileKey(result.rows[0].perfil) !== "grupo_familiar") {
      throw httpError("Los integrantes solo están disponibles para expedientes de grupo familiar", 409);
    }
  }

  async function listMembers(userId) {
    await ensureGroupProfile(userId);
    const result = await pool.query(
      `SELECT id,full_name,relationship,date_of_birth,ds160_confirmation_number,created_at,updated_at
       FROM family_group_members WHERE user_id=$1 ORDER BY created_at,id`,
      [userId]
    );
    return result.rows.map(presentMember);
  }

  async function createMember(userId, payload) {
    await ensureGroupProfile(userId);
    const data = normalizeMemberPayload(payload);
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM family_group_members WHERE user_id=$1", [userId]);
    if (Number(count.rows[0]?.total) >= MAX_FAMILY_MEMBERS) {
      throw httpError(`Un expediente puede registrar hasta ${MAX_FAMILY_MEMBERS} integrantes adicionales`, 409);
    }
    const result = await pool.query(
      `INSERT INTO family_group_members (user_id,full_name,relationship,date_of_birth,ds160_confirmation_number)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,full_name,relationship,date_of_birth,ds160_confirmation_number,created_at,updated_at`,
      [userId, data.fullName, data.relationship, data.dateOfBirth, data.ds160ConfirmationNumber || null]
    );
    return presentMember(result.rows[0]);
  }

  async function updateMember(userId, memberId, payload) {
    await ensureGroupProfile(userId);
    const id = parsePositiveId(memberId);
    const data = normalizeMemberPayload(payload, { partial: true });
    const fields = [];
    const values = [];
    const add = (column, value) => {
      values.push(value);
      fields.push(`${column}=$${values.length}`);
    };
    if (data.fullName !== undefined) add("full_name", data.fullName);
    if (data.relationship !== undefined) add("relationship", data.relationship);
    if (data.dateOfBirth !== undefined) add("date_of_birth", data.dateOfBirth);
    if (data.ds160ConfirmationNumber !== undefined) add("ds160_confirmation_number", data.ds160ConfirmationNumber);
    if (!fields.length) throw httpError("No se enviaron cambios", 400);
    values.push(userId, id);
    const result = await pool.query(
      `UPDATE family_group_members SET ${fields.join(",")},updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$${values.length - 1} AND id=$${values.length}
       RETURNING id,full_name,relationship,date_of_birth,ds160_confirmation_number,created_at,updated_at`,
      values
    );
    if (!result.rows.length) throw httpError("Integrante no encontrado", 404);
    return presentMember(result.rows[0]);
  }

  async function deleteMember(userId, memberId) {
    await ensureGroupProfile(userId);
    const id = parsePositiveId(memberId);
    const documentPrefix = `family-${id}-%`;
    const documents = await pool.query(
      "SELECT COUNT(*)::int AS total FROM documentos WHERE usuario_id=$1 AND documento_key LIKE $2",
      [userId, documentPrefix]
    );
    if (Number(documents.rows[0]?.total) > 0) {
      throw httpError("Elimina primero los documentos cargados para este integrante", 409);
    }
    const result = await pool.query(
      "DELETE FROM family_group_members WHERE user_id=$1 AND id=$2 RETURNING id",
      [userId, id]
    );
    if (!result.rows.length) throw httpError("Integrante no encontrado", 404);
    return { id };
  }

  return { createMember, deleteMember, listMembers, updateMember };
}

module.exports = { MAX_FAMILY_MEMBERS, RELATIONSHIPS, createFamilyGroupService };
