const { uploadStoredFile, deleteStoredFile, getStoredFile } = require("../storage");

function getSessionResponses(session) {
  if (Array.isArray(session?.responses)) return session.responses;
  if (typeof session?.responses === "string") {
    try {
      const parsed = JSON.parse(session.responses);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildAudioRoute(sessionId, questionId) {
  return `/interview-sessions/${sessionId}/audio/${encodeURIComponent(questionId)}`;
}

function presentSession(session) {
  if (!session) return session;
  const responses = getSessionResponses(session).map((response) => {
    if (!response.audio?.key) return response;
    return {
      ...response,
      audio: {
        ...response.audio,
        url: buildAudioRoute(session.id, response.id),
      },
    };
  });

  return { ...session, responses };
}

function createInterviewSessionService(pool) {
  async function ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interview_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES usuario(id_usuario),
        user_name VARCHAR(200),
        user_email VARCHAR(200),
        status VARCHAR(30) DEFAULT 'pending',
        responses JSONB NOT NULL DEFAULT '[]',
        feedback TEXT,
        rating INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP
      )
    `);
  }

  function parseSessionPayload(rawPayload) {
    if (!rawPayload) {
      const error = new Error("Datos de sesión requeridos");
      error.statusCode = 400;
      throw error;
    }

    if (typeof rawPayload === "object") return rawPayload;

    try {
      return JSON.parse(rawPayload);
    } catch {
      const error = new Error("Formato de sesión inválido");
      error.statusCode = 400;
      throw error;
    }
  }

  function normalizeUser(user = {}) {
    const parsedId =
      user.id === undefined || user.id === null || user.id === ""
        ? null
        : Number(user.id);

    if (parsedId !== null && Number.isNaN(parsedId)) {
      const error = new Error("user.id debe ser numérico");
      error.statusCode = 400;
      throw error;
    }

    return {
      id: parsedId,
      name: String(user.nombre || user.name || "Usuario").trim(),
      email: String(user.correo || user.email || "").trim(),
    };
  }

  function normalizeQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      const error = new Error("La sesión debe incluir preguntas");
      error.statusCode = 400;
      throw error;
    }

    return questions.map((question, index) => ({
      id: String(question.id || `question-${index + 1}`),
      text: String(question.text || "").trim(),
      recorded: Boolean(question.recorded),
      duration: Number(question.duration) || 0,
    }));
  }

  async function createSession(rawPayload, files = [], { baseUrl = "" } = {}) {
    await ensureSchema();

    const payload = parseSessionPayload(rawPayload);
    const user = normalizeUser(payload.user);
    const questions = normalizeQuestions(payload.questions);
    const uploadedKeys = [];

    try {
      const responses = [];

      for (const question of questions) {
        const audioFile = files.find(
          (file) => file.fieldname === `audio_${question.id}`
        );
        let audio = null;

        if (audioFile) {
          const uploadedAudio = await uploadStoredFile({
            ...audioFile,
            originalname: `interview-${user.id || "guest"}-${question.id}.webm`,
          }, { baseUrl });
          uploadedKeys.push(uploadedAudio.key);
          audio = {
            url: uploadedAudio.url,
            key: uploadedAudio.key,
            provider: uploadedAudio.provider,
            mimetype: audioFile.mimetype,
            size: audioFile.size,
          };
        }

        responses.push({
          ...question,
          recorded: Boolean(audioFile) || question.recorded,
          audio,
        });
      }

      const result = await pool.query(
        `INSERT INTO interview_sessions
          (user_id, user_name, user_email, status, responses)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING id, user_id, user_name, user_email, status, responses,
                   feedback, rating, created_at, reviewed_at`,
        [user.id, user.name, user.email, JSON.stringify(responses)]
      );

      return presentSession(result.rows[0]);
    } catch (error) {
      await Promise.all(
        uploadedKeys.map((key) =>
          deleteStoredFile(key).catch((cleanupError) => {
            console.error("INTERVIEW AUDIO CLEANUP ERROR:", cleanupError);
          })
        )
      );

      throw error;
    }
  }

  async function listSessions({ status, advisorId } = {}) {
    await ensureSchema();

    const values = [];
    const where = [];

    if (status) {
      values.push(status);
      where.push(`s.status = $${values.length}`);
    }

    if (advisorId) {
      values.push(Number(advisorId));
      where.push(`t.id_asesor = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT s.id, s.user_id, s.user_name, s.user_email, s.status, s.responses,
              s.feedback, s.rating, s.created_at, s.reviewed_at,
              advisor.id_usuario AS advisor_id, advisor.nombre AS advisor_name
       FROM interview_sessions s
       LEFT JOIN tramite t ON t.id_usuario = s.user_id
       LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY s.created_at DESC, s.id DESC`,
      values
    );

    return result.rows.map(presentSession);
  }

  async function listUserSessions(userId) {
    await ensureSchema();

    const parsedUserId = Number(userId);
    if (Number.isNaN(parsedUserId)) {
      const error = new Error("user_id debe ser numérico");
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `SELECT id, user_id, user_name, user_email, status, responses,
              feedback, rating, created_at, reviewed_at
       FROM interview_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [parsedUserId]
    );

    return result.rows.map(presentSession);
  }

  async function getSession(id, { advisorId, userId } = {}) {
    await ensureSchema();

    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      const error = new Error("ID inválido");
      error.statusCode = 400;
      throw error;
    }

    const values = [parsedId];
    if (advisorId) values.push(Number(advisorId));
    if (userId) values.push(Number(userId));
    const advisorParameter = advisorId ? 2 : null;
    const userParameter = userId ? values.length : null;
    const result = await pool.query(
      `SELECT id, user_id, user_name, user_email, status, responses,
              feedback, rating, created_at, reviewed_at
       FROM interview_sessions s
       WHERE s.id = $1
         ${advisorId ? `AND EXISTS (
           SELECT 1 FROM tramite t
           WHERE t.id_usuario = s.user_id AND t.id_asesor = $${advisorParameter}
         )` : ""}
         ${userId ? `AND s.user_id = $${userParameter}` : ""}`,
      values
    );

    if (result.rows.length === 0) {
      const error = new Error("Sesión no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return presentSession(result.rows[0]);
  }

  async function getSessionAudio(id, questionId, { userId } = {}) {
    await ensureSchema();

    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      const error = new Error("ID invÃ¡lido");
      error.statusCode = 400;
      throw error;
    }

    const values = [parsedId];
    if (userId) values.push(Number(userId));
    const result = await pool.query(
      `SELECT id, responses
       FROM interview_sessions
       WHERE id = $1${userId ? " AND user_id = $2" : ""}`,
      values
    );

    const session = result.rows[0];
    if (!session) {
      const error = new Error("SesiÃ³n no encontrada");
      error.statusCode = 404;
      throw error;
    }

    const response = getSessionResponses(session).find(
      (item) => String(item.id) === String(questionId)
    );

    if (!response?.audio) {
      const error = new Error("Audio no encontrado");
      error.statusCode = 404;
      throw error;
    }

    if (!response.audio.key) {
      return {
        redirectUrl: response.audio.url,
      };
    }

    const storedFile = await getStoredFile(response.audio.key);
    return {
      storedFile,
      response,
      filename: `entrevista-${parsedId}-${questionId}.webm`,
    };
  }

  async function updateFeedback(id, payload = {}, { advisorId } = {}) {
    await ensureSchema();

    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      const error = new Error("ID inválido");
      error.statusCode = 400;
      throw error;
    }

    const feedback = String(payload.feedback || "").trim();
    if (!feedback) {
      const error = new Error("La retroalimentación es obligatoria");
      error.statusCode = 400;
      throw error;
    }

    const rating =
      payload.rating === undefined || payload.rating === null || payload.rating === ""
        ? null
        : Number(payload.rating);

    if (rating !== null && (Number.isNaN(rating) || rating < 1 || rating > 5)) {
      const error = new Error("La calificación debe estar entre 1 y 5");
      error.statusCode = 400;
      throw error;
    }

    const values = [feedback, rating, parsedId];
    if (advisorId) values.push(Number(advisorId));
    const result = await pool.query(
      `UPDATE interview_sessions
       SET feedback = $1,
           rating = $2,
           status = 'reviewed',
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3
         ${advisorId ? `AND EXISTS (
           SELECT 1 FROM tramite t
           WHERE t.id_usuario = interview_sessions.user_id AND t.id_asesor = $4
         )` : ""}
       RETURNING id, user_id, user_name, user_email, status, responses,
                 feedback, rating, created_at, reviewed_at`,
      values
    );

    if (result.rows.length === 0) {
      const error = new Error("Sesión no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return presentSession(result.rows[0]);
  }

  return {
    ensureSchema,
    createSession,
    listSessions,
    listUserSessions,
    getSession,
    getSessionAudio,
    updateFeedback,
  };
}

module.exports = createInterviewSessionService;
