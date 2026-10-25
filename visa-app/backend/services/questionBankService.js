const { SEED_QUESTION_EXAMPLES } = require("./questionBankSeedExamples");
const { PROFILE_KEYS, normalizeProfileKey } = require("../config/visaProfiles");

const CATEGORIES = [
  "General",
  "Viaje",
  "Finanzas",
  "Laboral",
  "Historial",
  "Migración",
  "Relaciones",
  "Personal",
];

const DIFFICULTIES = ["Fácil", "Media", "Alta"];
const MAX_RANDOM_QUESTIONS = 20;
const MAX_EXCLUDED_TEXT_LENGTH = 500;
// Ejemplos de respuesta fuerte/débil y por qué lo son; todos opcionales.
const EXAMPLE_FIELDS = ["ejemplo_fuerte", "explicacion_fuerte", "ejemplo_debil", "explicacion_debil"];
const MAX_EXAMPLE_TEXT_LENGTH = 2000;
const QUESTION_COLUMNS = `id, question, category, difficulty, is_required, created_at, activo, uso_count,
       visa_profiles, ${EXAMPLE_FIELDS.join(", ")}`;

const BASE_SEED_QUESTIONS = [
  {
    question: "¿Cuál es el propósito principal de su viaje?",
    category: "Viaje",
    difficulty: "Fácil",
    is_required: true,
  },
  {
    question: "¿Cuánto tiempo planea permanecer en el país?",
    category: "Viaje",
    difficulty: "Fácil",
    is_required: true,
  },
  {
    question: "¿Quién financiará su viaje y estadía?",
    category: "Finanzas",
    difficulty: "Media",
    is_required: true,
  },
  {
    question: "¿Tiene familiares o conocidos viviendo en el país destino?",
    category: "Relaciones",
    difficulty: "Media",
    is_required: false,
  },
  {
    question: "¿Cuál es su ocupación actual?",
    category: "Laboral",
    difficulty: "Fácil",
    is_required: true,
  },
  {
    question: "¿Desde cuándo trabaja en su empleo actual?",
    category: "Laboral",
    difficulty: "Media",
    is_required: false,
  },
  {
    question: "¿Ha viajado anteriormente a este país?",
    category: "Historial",
    difficulty: "Media",
    is_required: false,
  },
  {
    question: "¿Ha visitado otros países en los últimos cinco años?",
    category: "Historial",
    difficulty: "Media",
    is_required: false,
  },
  {
    question: "¿Cuenta con reservación de hospedaje o dirección de estadía?",
    category: "Viaje",
    difficulty: "Media",
    is_required: true,
  },
  {
    question: "¿Cuál es su salario o ingreso mensual aproximado?",
    category: "Finanzas",
    difficulty: "Alta",
    is_required: false,
  },
  {
    question: "¿Tiene propiedades, negocios o activos en su país de origen?",
    category: "Finanzas",
    difficulty: "Alta",
    is_required: false,
  },
  {
    question: "¿Cuál es su estado civil?",
    category: "Personal",
    difficulty: "Fácil",
    is_required: false,
  },
  {
    question: "¿Viajará solo o acompañado?",
    category: "Relaciones",
    difficulty: "Fácil",
    is_required: false,
  },
  {
    question: "¿Qué actividades realizará durante su estadía?",
    category: "Viaje",
    difficulty: "Media",
    is_required: true,
  },
  {
    question: "¿Tiene intención de trabajar o estudiar durante su visita?",
    category: "Migración",
    difficulty: "Alta",
    is_required: true,
  },
  { question: "¿A qué ciudad o ciudades planea viajar?", category: "Viaje", difficulty: "Fácil", is_required: true },
  { question: "¿Cuándo planea viajar y por qué eligió esas fechas?", category: "Viaje", difficulty: "Media", is_required: true },
  { question: "¿Dónde se hospedará durante su visita?", category: "Viaje", difficulty: "Fácil", is_required: true },
  { question: "¿Cómo organizó su itinerario de viaje?", category: "Viaje", difficulty: "Media", is_required: false },
  { question: "¿Por qué necesita realizar este viaje en este momento?", category: "Viaje", difficulty: "Alta", is_required: false },
  { question: "¿Cuál es el costo estimado de su viaje?", category: "Finanzas", difficulty: "Media", is_required: true },
  { question: "¿Cómo demostrará que cuenta con fondos suficientes para el viaje?", category: "Finanzas", difficulty: "Alta", is_required: false },
  { question: "Si otra persona pagará el viaje, ¿qué relación tiene con usted?", category: "Finanzas", difficulty: "Media", is_required: false },
  { question: "¿En qué empresa trabaja y cuál es su puesto?", category: "Laboral", difficulty: "Fácil", is_required: true },
  { question: "¿Cuáles son sus principales responsabilidades laborales?", category: "Laboral", difficulty: "Media", is_required: false },
  { question: "¿Su empleador autorizó sus vacaciones o ausencia?", category: "Laboral", difficulty: "Media", is_required: false },
  { question: "¿Qué compromisos laborales tiene al regresar?", category: "Laboral", difficulty: "Alta", is_required: true },
  { question: "¿Ha solicitado anteriormente una visa estadounidense?", category: "Historial", difficulty: "Media", is_required: true },
  { question: "¿Alguna vez le han negado una visa?", category: "Historial", difficulty: "Alta", is_required: true },
  { question: "Si le negaron una visa, ¿qué ha cambiado desde aquella solicitud?", category: "Historial", difficulty: "Alta", is_required: false },
  { question: "¿Alguna vez permaneció más tiempo del autorizado en otro país?", category: "Migración", difficulty: "Alta", is_required: true },
  { question: "¿Alguien ha presentado una petición migratoria a su favor?", category: "Migración", difficulty: "Alta", is_required: false },
  { question: "¿Qué razones concretas tiene para regresar a su país?", category: "Migración", difficulty: "Alta", is_required: true },
  { question: "¿Tiene familiares inmediatos en Estados Unidos?", category: "Relaciones", difficulty: "Media", is_required: true },
  { question: "¿Con quién viajará y qué relación tiene con esa persona?", category: "Relaciones", difficulty: "Fácil", is_required: false },
  { question: "¿A quién visitará durante su viaje?", category: "Relaciones", difficulty: "Media", is_required: false },
  { question: "¿Tiene hijos o personas que dependan de usted?", category: "Personal", difficulty: "Media", is_required: false },
  { question: "¿Dónde vive actualmente y desde cuándo reside allí?", category: "Personal", difficulty: "Fácil", is_required: false },
  { question: "¿Por qué eligió esta institución educativa o programa de estudios?", category: "General", difficulty: "Alta", is_required: false },
  { question: "¿Cómo se relaciona este viaje con sus planes personales o profesionales?", category: "General", difficulty: "Alta", is_required: false },
];

const STUDENT_ONLY_QUESTIONS = new Set([
  "¿Por qué eligió esta institución educativa o programa de estudios?",
]);
const VISITOR_ONLY_QUESTIONS = new Set([
  "¿Tiene intención de trabajar o estudiar durante su visita?",
]);

const SEED_QUESTIONS = BASE_SEED_QUESTIONS.map((item) => ({
  ...item,
  visa_profiles: STUDENT_ONLY_QUESTIONS.has(item.question)
    ? ["estudiante"]
    : VISITOR_ONLY_QUESTIONS.has(item.question)
      ? PROFILE_KEYS.filter((profile) => profile !== "estudiante")
      : [...PROFILE_KEYS],
  ...SEED_QUESTION_EXAMPLES[item.question],
}));

function createQuestionBankService(pool) {
  async function ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        category VARCHAR(100),
        difficulty VARCHAR(20),
        is_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE question_bank
      ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS uso_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS visa_profiles TEXT[] NOT NULL DEFAULT ARRAY['turismo_negocios','estudiante','renovacion','grupo_familiar','adulto_mayor']::text[],
      ADD COLUMN IF NOT EXISTS ejemplo_fuerte TEXT,
      ADD COLUMN IF NOT EXISTS explicacion_fuerte TEXT,
      ADD COLUMN IF NOT EXISTS ejemplo_debil TEXT,
      ADD COLUMN IF NOT EXISTS explicacion_debil TEXT`);
  }

  async function seedInitialQuestions() {
    await ensureSchema();

    const values = [];
    const columnsPerRow = 5 + EXAMPLE_FIELDS.length;
    const placeholders = SEED_QUESTIONS.map((item, index) => {
      const offset = index * columnsPerRow;
      values.push(
        item.question,
        item.category,
        item.difficulty,
        item.is_required,
        item.visa_profiles,
        ...EXAMPLE_FIELDS.map((field) => item[field] ?? null)
      );
      const examplePlaceholders = EXAMPLE_FIELDS.map((_field, fieldIndex) => `$${offset + 6 + fieldIndex}::text`);
      return `($${offset + 1}::text, $${offset + 2}::text, $${offset + 3}::text, $${offset + 4}::boolean, $${offset + 5}::text[], ${examplePlaceholders.join(", ")})`;
    });
    const exampleColumns = EXAMPLE_FIELDS.join(", ");

    // Inserta las preguntas faltantes y completa los ejemplos de las que ya existían.
    // Solo se completan preguntas sin ningún ejemplo, para no pisar lo que un admin editó.
    await pool.query(
      `WITH seed_questions (question, category, difficulty, is_required, visa_profiles, ${exampleColumns}) AS (
         VALUES ${placeholders.join(", ")}
       ),
       filled_examples AS (
         UPDATE question_bank existing
         SET visa_profiles = seed.visa_profiles,
             ${EXAMPLE_FIELDS.map((field) => `${field} = CASE WHEN ${EXAMPLE_FIELDS.map((candidate) => `existing.${candidate} IS NULL`).join(" AND ")} THEN seed.${field} ELSE existing.${field} END`).join(", ")}
         FROM seed_questions seed
         WHERE LOWER(TRIM(existing.question)) = LOWER(TRIM(seed.question))
         RETURNING existing.id
       )
       INSERT INTO question_bank (question, category, difficulty, is_required, visa_profiles, ${exampleColumns})
       SELECT seed.question, seed.category, seed.difficulty, seed.is_required,
              seed.visa_profiles, ${EXAMPLE_FIELDS.map((field) => `seed.${field}`).join(", ")}
       FROM seed_questions seed
       WHERE NOT EXISTS (
         SELECT 1 FROM question_bank existing
         WHERE LOWER(TRIM(existing.question)) = LOWER(TRIM(seed.question))
       )`,
      values
    );
  }

  function normalizeQuestionPayload(payload = {}, { partial = false } = {}) {
    const normalized = {};

    if (!partial || payload.question !== undefined) {
      normalized.question = String(payload.question || "").trim();
      if (!normalized.question) {
        const error = new Error("La pregunta es obligatoria");
        error.statusCode = 400;
        throw error;
      }
    }

    if (!partial || payload.category !== undefined) {
      const category = String(payload.category || "General").trim();
      if (!CATEGORIES.includes(category)) {
        const error = new Error("Categoría inválida");
        error.statusCode = 400;
        throw error;
      }
      normalized.category = category;
    }

    if (!partial || payload.difficulty !== undefined) {
      const difficulty = String(payload.difficulty || "Media").trim();
      if (!DIFFICULTIES.includes(difficulty)) {
        const error = new Error("Dificultad inválida");
        error.statusCode = 400;
        throw error;
      }
      normalized.difficulty = difficulty;
    }

    if (!partial || payload.is_required !== undefined) {
      normalized.is_required =
        payload.is_required === true ||
        payload.is_required === "true" ||
        payload.is_required === 1 ||
        payload.is_required === "1";
    }

    // Solo se incluyen los ejemplos enviados, para que un PUT sin ellos no los borre.
    for (const field of EXAMPLE_FIELDS) {
      if (payload[field] === undefined) continue;
      if (payload[field] !== null && typeof payload[field] !== "string") {
        const error = new Error(`${field} debe ser texto`);
        error.statusCode = 400;
        throw error;
      }
      const value = (payload[field] || "").trim();
      if (value.length > MAX_EXAMPLE_TEXT_LENGTH) {
        const error = new Error(`${field} no puede superar ${MAX_EXAMPLE_TEXT_LENGTH} caracteres`);
        error.statusCode = 400;
        throw error;
      }
      normalized[field] = value || null;
    }

    return normalized;
  }

  async function listQuestions({ includeInactive = false, profile } = {}) {
    await ensureSchema();

    const profileKey = normalizeProfileKey(profile);
    const filters = [];
    const values = [];
    if (!includeInactive) filters.push("activo = TRUE");
    if (profileKey) {
      values.push(profileKey);
      filters.push(`$${values.length} = ANY(visa_profiles)`);
    }

    const sql = `SELECT ${QUESTION_COLUMNS}
       FROM question_bank
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY created_at DESC, id DESC`;
    const result = values.length ? await pool.query(sql, values) : await pool.query(sql);

    return result.rows;
  }

  async function listRandomQuestions({ count = "4", exclude = "", excludeText, profile } = {}) {
    const rawCount = String(count);
    if (!/^[1-9]\d*$/.test(rawCount) || Number(rawCount) > MAX_RANDOM_QUESTIONS) {
      const error = new Error(`count debe ser un entero entre 1 y ${MAX_RANDOM_QUESTIONS}`);
      error.statusCode = 400;
      throw error;
    }

    const excludedIds = [];
    const excludedCategories = [];
    const exclusions = String(exclude).trim();
    if (exclusions) {
      for (const token of exclusions.split(",")) {
        const value = token.trim();
        if (value.toLowerCase() === "intro") {
          // La pregunta introductoria no vive en el banco. Su tema corresponde a Viaje.
          excludedCategories.push("viaje");
        } else if (/^id:[1-9]\d*$/i.test(value) && Number(value.slice(3)) <= 2147483647) {
          excludedIds.push(Number(value.slice(3)));
        } else if (/^category:.+$/i.test(value)) {
          const category = value.slice(9).trim();
          if (!CATEGORIES.some((item) => item.toLowerCase() === category.toLowerCase())) {
            const error = new Error("Categoría de exclusión inválida");
            error.statusCode = 400;
            throw error;
          }
          excludedCategories.push(category.toLowerCase());
        } else {
          const error = new Error("exclude debe contener intro, id:<entero> o category:<categoría>");
          error.statusCode = 400;
          throw error;
        }
      }
    }

    let normalizedExcludedText = null;
    if (excludeText !== undefined) {
      if (typeof excludeText !== "string" || !excludeText.trim() || excludeText.length > MAX_EXCLUDED_TEXT_LENGTH) {
        const error = new Error(`excludeText debe ser un texto de 1 a ${MAX_EXCLUDED_TEXT_LENGTH} caracteres`);
        error.statusCode = 400;
        throw error;
      }
      normalizedExcludedText = excludeText.trim();
    }

    await ensureSchema();
    const requestedCount = Number(rawCount);
    const profileKey = normalizeProfileKey(profile);
    const profileFilter = profileKey ? "AND $5::text = ANY(visa_profiles)" : "";
    const values = [excludedIds, excludedCategories, normalizedExcludedText, requestedCount];
    if (profileKey) values.push(profileKey);
    const result = await pool.query(
      `WITH eligible AS (
         SELECT DISTINCT ON (LOWER(TRIM(question)))
                ${QUESTION_COLUMNS}
         FROM question_bank
         WHERE activo = TRUE
           AND id <> ALL($1::int[])
           AND (category IS NULL OR LOWER(TRIM(category)) <> ALL($2::text[]))
           AND ($3::text IS NULL OR LOWER(TRIM(question)) <> LOWER(TRIM($3::text)))
           ${profileFilter}
         ORDER BY LOWER(TRIM(question)), id
       )
       SELECT ${QUESTION_COLUMNS}
       FROM eligible
       ORDER BY RANDOM()
       LIMIT $4`,
      values
    );

    if (result.rows.length < requestedCount) {
      const error = new Error(`No hay suficientes preguntas activas elegibles: se necesitan ${requestedCount} y hay ${result.rows.length}.`);
      error.statusCode = 409;
      throw error;
    }
    return result.rows;
  }

  async function createQuestion(payload) {
    await ensureSchema();

    const data = normalizeQuestionPayload(payload);
    const result = await pool.query(
      `INSERT INTO question_bank (question, category, difficulty, is_required, ${EXAMPLE_FIELDS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${QUESTION_COLUMNS}`,
      [
        data.question,
        data.category,
        data.difficulty,
        data.is_required,
        ...EXAMPLE_FIELDS.map((field) => data[field] ?? null),
      ]
    );

    return result.rows[0];
  }

  async function updateQuestion(id, payload) {
    await ensureSchema();

    const questionId = Number(id);
    if (Number.isNaN(questionId)) {
      const error = new Error("ID inválido");
      error.statusCode = 400;
      throw error;
    }

    const data = normalizeQuestionPayload(payload);
    const assignments = ["question = $1", "category = $2", "difficulty = $3", "is_required = $4"];
    const values = [data.question, data.category, data.difficulty, data.is_required];
    for (const field of EXAMPLE_FIELDS) {
      if (data[field] === undefined) continue;
      values.push(data[field]);
      assignments.push(`${field} = $${values.length}`);
    }
    values.push(questionId);

    const result = await pool.query(
      `UPDATE question_bank
       SET ${assignments.join(",\n           ")}
       WHERE id = $${values.length}
       RETURNING ${QUESTION_COLUMNS}`,
      values
    );

    if (result.rows.length === 0) {
      const error = new Error("Pregunta no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  }

  async function deleteQuestion(id) {
    await ensureSchema();

    const questionId = Number(id);
    if (Number.isNaN(questionId)) {
      const error = new Error("ID inválido");
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `DELETE FROM question_bank
       WHERE id = $1
       RETURNING id`,
      [questionId]
    );

    if (result.rows.length === 0) {
      const error = new Error("Pregunta no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  }

  async function setQuestionActive(id, activo) {
    await ensureSchema();

    const questionId = Number(id);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      const error = new Error("ID inválido");
      error.statusCode = 400;
      throw error;
    }
    if (typeof activo !== "boolean") {
      const error = new Error("El estado activo debe ser booleano");
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `UPDATE question_bank SET activo = $1
       WHERE id = $2
       RETURNING ${QUESTION_COLUMNS}`,
      [activo, questionId]
    );

    if (result.rows.length === 0) {
      const error = new Error("Pregunta no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  }

  return {
    ensureSchema,
    seedInitialQuestions,
    listQuestions,
    listRandomQuestions,
    createQuestion,
    updateQuestion,
    setQuestionActive,
    deleteQuestion,
  };
}

module.exports = {
  CATEGORIES,
  DIFFICULTIES,
  EXAMPLE_FIELDS,
  SEED_QUESTIONS,
  createQuestionBankService,
};
