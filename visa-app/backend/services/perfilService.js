const {
  PROFILE_CONFIGS,
  getDocumentsForProfile,
  getProfileConfig,
  normalizeProfileKey,
} = require("../config/visaProfiles");

const PERFIL_A_VISA = Object.fromEntries(
  Object.entries(PROFILE_CONFIGS).map(([key, config]) => [key, config.label])
);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function calculateRenewalEligibility(details = {}) {
  const expiration = details.priorVisaExpirationDate
    ? new Date(`${details.priorVisaExpirationDate}T00:00:00Z`)
    : null;
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  const expiredWithinTwelveMonths = Boolean(
    expiration
      && !Number.isNaN(expiration.getTime())
      && expiration >= twelveMonthsAgo
      && expiration <= today
  );
  const criteria = {
    bVisa: details.priorVisaClass === "B1/B2",
    expiredWithinTwelveMonths,
    fullValidity: details.priorVisaFullValidity === true,
    issuedAtAgeEighteenOrOlder: details.issuedAtAgeEighteenOrOlder === true,
    refusalAcceptable: ["none", "overcome_or_waived"].includes(details.refusalStatus),
    noKnownIneligibility: details.hasPotentialIneligibility === false,
  };
  const complete = [
    "priorVisaExpirationDate",
    "priorVisaClass",
    "priorVisaFullValidity",
    "issuedAtAgeEighteenOrOlder",
    "refusalStatus",
    "hasPotentialIneligibility",
  ].every((field) => details[field] !== undefined && details[field] !== null && details[field] !== "");
  return {
    complete,
    potentiallyEligible: complete && Object.values(criteria).every(Boolean),
    criteria,
    officialDecisionRequired: true,
  };
}

function normalizeVisaDetails(profile, payload = {}) {
  if (profile !== "renovacion") {
    throw httpError("La evaluación de renovación solo está disponible para el perfil renovación B1/B2", 409);
  }
  const allowedClasses = new Set(["B1/B2"]);
  const allowedRefusalStatuses = new Set(["none", "overcome_or_waived", "unresolved"]);
  const priorVisaClass = String(payload.priorVisaClass || "").trim().toUpperCase();
  const priorVisaExpirationDate = String(payload.priorVisaExpirationDate || "").trim();
  const refusalStatus = String(payload.refusalStatus || "").trim();
  if (!allowedClasses.has(priorVisaClass)) throw httpError("La renovación disponible corresponde a visa B1/B2", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(priorVisaExpirationDate)) {
    throw httpError("La fecha de vencimiento de la visa anterior es obligatoria", 400);
  }
  if (Number.isNaN(new Date(`${priorVisaExpirationDate}T00:00:00Z`).getTime())) {
    throw httpError("La fecha de vencimiento de la visa anterior no es válida", 400);
  }
  if (!allowedRefusalStatuses.has(refusalStatus)) throw httpError("El estado de denegaciones no es válido", 400);
  for (const field of ["priorVisaFullValidity", "issuedAtAgeEighteenOrOlder", "hasPotentialIneligibility"]) {
    if (typeof payload[field] !== "boolean") throw httpError(`${field} debe responderse con sí o no`, 400);
  }
  return {
    priorVisaClass,
    priorVisaExpirationDate,
    priorVisaFullValidity: payload.priorVisaFullValidity,
    issuedAtAgeEighteenOrOlder: payload.issuedAtAgeEighteenOrOlder,
    refusalStatus,
    hasPotentialIneligibility: payload.hasPotentialIneligibility,
  };
}

function calcularEtapa(progreso, perfil) {
  let etapa = Math.ceil((Number(progreso) || 10) / 16.66);
  if (perfil && etapa < 2) etapa = 2;
  if (etapa < 1) etapa = 1;
  if (etapa > 6) etapa = 6;
  return etapa;
}

function createPerfilService(pool, {
  userSchemaReady,
  tramiteSchemaReady,
  visaProfileSchemaReady = Promise.resolve(),
}) {

  async function findUserById(userId) {
    await userSchemaReady;
    const result = await pool.query(
      `SELECT id_usuario, nombre, correo, perfil, visa_details, avatar_updated_at,
              telefono, ciudad, pais,
              notificaciones_email, idioma, rol
       FROM usuario WHERE id_usuario = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async function guardarPerfil(userId, perfil) {
    const normalizedProfile = normalizeProfileKey(perfil);
    if (!normalizedProfile || normalizedProfile !== perfil) {
      throw httpError("Perfil de visa inválido", 400);
    }
    const result = await pool.query(
      `UPDATE usuario
       SET perfil = $1::varchar,
           visa_details = CASE WHEN perfil IS DISTINCT FROM $1::varchar THEN '{}'::jsonb ELSE visa_details END
       WHERE id_usuario = $2 RETURNING *`,
      [normalizedProfile, userId]
    );
    return result.rows[0] || null;
  }

  async function getProfileRequirements(userId) {
    await Promise.all([userSchemaReady, visaProfileSchemaReady]);
    const userResult = await pool.query(
      "SELECT perfil,visa_details FROM usuario WHERE id_usuario=$1",
      [userId]
    );
    if (!userResult.rows.length) throw httpError("Usuario no encontrado", 404);
    const profile = normalizeProfileKey(userResult.rows[0].perfil);
    const config = getProfileConfig(profile);
    if (!config) throw httpError("Selecciona un perfil de visa para consultar sus requisitos", 409);
    let familyMembers = [];
    if (config.caseType === "family") {
      const members = await pool.query(
        `SELECT id,full_name,relationship,date_of_birth,ds160_confirmation_number,created_at,updated_at
         FROM family_group_members WHERE user_id=$1 ORDER BY created_at,id`,
        [userId]
      );
      familyMembers = members.rows.map((member) => ({
        id: Number(member.id),
        fullName: member.full_name,
        full_name: member.full_name,
        relationship: member.relationship,
        dateOfBirth: member.date_of_birth instanceof Date
          ? member.date_of_birth.toISOString().slice(0, 10)
          : String(member.date_of_birth).slice(0, 10),
        ds160ConfirmationNumber: member.ds160_confirmation_number || "",
        ds160Complete: Boolean(member.ds160_confirmation_number),
      }));
    }
    const details = userResult.rows[0].visa_details || {};
    return {
      profile,
      label: config.label,
      visaClass: config.visaClass,
      applicationType: config.applicationType,
      caseType: config.caseType,
      seniorDefault: config.seniorDefault,
      interviewPolicy: config.interviewPolicy,
      guidance: config.guidance,
      officialChecklist: config.officialChecklist || [],
      governmentFeeUsdCentsPerPerson: config.governmentFeeUsdCentsPerPerson,
      sevisFeeUsdCents: config.sevisFeeUsdCents || null,
      personCount: 1 + familyMembers.length,
      familyMembers,
      documents: getDocumentsForProfile(profile, familyMembers),
      details,
      renewalEligibility: profile === "renovacion" ? calculateRenewalEligibility(details) : null,
    };
  }

  async function updateVisaDetails(userId, payload) {
    await userSchemaReady;
    const current = await pool.query("SELECT perfil FROM usuario WHERE id_usuario=$1", [userId]);
    if (!current.rows.length) throw httpError("Usuario no encontrado", 404);
    const profile = normalizeProfileKey(current.rows[0].perfil);
    const details = normalizeVisaDetails(profile, payload);
    const result = await pool.query(
      "UPDATE usuario SET visa_details=$1::jsonb WHERE id_usuario=$2 RETURNING visa_details",
      [JSON.stringify(details), userId]
    );
    return {
      details: result.rows[0].visa_details,
      renewalEligibility: profile === "renovacion" ? calculateRenewalEligibility(result.rows[0].visa_details) : null,
    };
  }

  async function getTramiteByUserId(userId) {
    await tramiteSchemaReady;
    const result = await pool.query(
      "SELECT * FROM tramite WHERE id_usuario = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  async function getOrCreateTramite(userId, hasProfile) {
    await tramiteSchemaReady;
    let tramite = await getTramiteByUserId(userId);

    if (!tramite) {
      const result = await pool.query(
        `INSERT INTO tramite (id_usuario, estado, etapa_actual, progreso, siguiente_paso, mensaje)
         VALUES ($1, 'En proceso', $2, $3, $4, $5)
         RETURNING *`,
        hasProfile
          ? [userId, "Asignación de asesor", 10, "Esperar asignación de asesor", "Puedes cargar documentos mientras asignamos a tu asesor"]
          : [userId, "Configuración de perfil", 0, "Seleccionar perfil de visa", "Configura tu perfil para comenzar"]
      );
      tramite = result.rows[0];
    }

    return tramite;
  }

  async function avanzarTramiteDS160(userId) {
    const tramite = await getOrCreateTramite(userId, true);
    const assigned = Boolean(tramite.id_asesor);
    if (tramite.progreso < 17) {
      await pool.query(
        `UPDATE tramite
         SET etapa_actual = $2,
             progreso = $3,
             siguiente_paso = $4,
             mensaje = $5
         WHERE id_usuario = $1`,
        assigned
          ? [userId, "Formulario DS-160", 17, "Completar el formulario DS-160", "Perfil configurado. Ahora completa el formulario DS-160."]
          : [userId, "Asignación de asesor", 10, "Esperar asignación de asesor", "Puedes cargar documentos mientras un administrador asigna tu asesor."]
      );
    }
    return { assigned };
  }

  async function updateUsuarioPerfil(userId, campos) {
    await userSchemaReady;

    const sets = [];
    const valores = [];
    let i = 1;

    if (campos.nombre !== undefined) { sets.push(`nombre = $${i++}`); valores.push(campos.nombre); }
    if (campos.telefono !== undefined) { sets.push(`telefono = $${i++}`); valores.push(campos.telefono); }
    if (campos.ciudad !== undefined) { sets.push(`ciudad = $${i++}`); valores.push(campos.ciudad); }
    if (campos.pais !== undefined) { sets.push(`pais = $${i++}`); valores.push(campos.pais); }
    if (campos.notificacionesEmail !== undefined) { sets.push(`notificaciones_email = $${i++}`); valores.push(campos.notificacionesEmail); }
    if (campos.idioma !== undefined) { sets.push(`idioma = $${i++}`); valores.push(campos.idioma); }

    if (sets.length === 0) return null;

    valores.push(userId);

    const result = await pool.query(
      `UPDATE usuario
       SET ${sets.join(", ")}
       WHERE id_usuario = $${i}
       RETURNING id_usuario, nombre, correo, perfil,
                 telefono, ciudad, pais,
                 notificaciones_email, idioma`,
      valores
    );

    return result.rows[0] || null;
  }

  return {
    PERFIL_A_VISA,
    calcularEtapa,
    findUserById,
    guardarPerfil,
    getTramiteByUserId,
    getOrCreateTramite,
    getProfileRequirements,
    avanzarTramiteDS160,
    updateVisaDetails,
    updateUsuarioPerfil,
  };
}

module.exports = createPerfilService;
