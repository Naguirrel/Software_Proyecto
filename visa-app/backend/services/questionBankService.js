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

const SEED_QUESTIONS = [
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
      ADD COLUMN IF NOT EXISTS uso_count INT DEFAULT 0`);
  }

  async function seedInitialQuestions() {
    await ensureSchema();

    const values = [];
    const placeholders = SEED_QUESTIONS.map((item, index) => {
      const offset = index * 4;
      values.push(item.question, item.category, item.difficulty, item.is_required);
      return `($${offset + 1}::text, $${offset + 2}::text, $${offset + 3}::text, $${offset + 4}::boolean)`;
    });

    await pool.query(
      `WITH seed_questions (question, category, difficulty, is_required) AS (
         VALUES ${placeholders.join(", ")}
       )
       INSERT INTO question_bank (question, category, difficulty, is_required)
       SELECT seed.question, seed.category, seed.difficulty, seed.is_required
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

    return normalized;
  }

  async function listQuestions({ includeInactive = false } = {}) {
    await ensureSchema();

    const result = await pool.query(
      `SELECT id, question, category, difficulty, is_required, created_at, activo, uso_count
       FROM question_bank
       ${includeInactive ? "" : "WHERE activo = TRUE"}
       ORDER BY created_at DESC, id DESC`
    );

    return result.rows;
  }

  async function listRandomQuestions({ count = "4", exclude = "", excludeText } = {}) {
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
    const result = await pool.query(
      `WITH eligible AS (
         SELECT DISTINCT ON (LOWER(TRIM(question)))
                id, question, category, difficulty, is_required, created_at, activo, uso_count
         FROM question_bank
         WHERE activo = TRUE
           AND id <> ALL($1::int[])
           AND (category IS NULL OR LOWER(TRIM(category)) <> ALL($2::text[]))
           AND ($3::text IS NULL OR LOWER(TRIM(question)) <> LOWER(TRIM($3::text)))
         ORDER BY LOWER(TRIM(question)), id
       )
       SELECT id, question, category, difficulty, is_required, created_at, activo, uso_count
       FROM eligible
       ORDER BY RANDOM()
       LIMIT $4`,
      [excludedIds, excludedCategories, normalizedExcludedText, requestedCount]
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
      `INSERT INTO question_bank (question, category, difficulty, is_required)
       VALUES ($1, $2, $3, $4)
       RETURNING id, question, category, difficulty, is_required, created_at, activo, uso_count`,
      [data.question, data.category, data.difficulty, data.is_required]
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
    const result = await pool.query(
      `UPDATE question_bank
       SET question = $1,
           category = $2,
           difficulty = $3,
           is_required = $4
       WHERE id = $5
       RETURNING id, question, category, difficulty, is_required, created_at, activo, uso_count`,
      [data.question, data.category, data.difficulty, data.is_required, questionId]
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
       RETURNING id, question, category, difficulty, is_required, created_at, activo, uso_count`,
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
  SEED_QUESTIONS,
  createQuestionBankService,
};
