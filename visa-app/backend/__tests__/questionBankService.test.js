const {
  CATEGORIES,
  DIFFICULTIES,
  EXAMPLE_FIELDS,
  SEED_QUESTIONS,
  createQuestionBankService,
} = require("../services/questionBankService");

describe("question bank seed catalog", () => {
  test("contains a broad, valid and duplicate-free interview catalog", () => {
    expect(SEED_QUESTIONS).toHaveLength(40);
    expect(new Set(SEED_QUESTIONS.map((item) => item.question.toLocaleLowerCase("es"))).size).toBe(SEED_QUESTIONS.length);
    expect(SEED_QUESTIONS.every((item) => CATEGORIES.includes(item.category))).toBe(true);
    expect(SEED_QUESTIONS.every((item) => DIFFICULTIES.includes(item.difficulty))).toBe(true);
    expect(SEED_QUESTIONS.filter((item) => item.is_required).length).toBeGreaterThanOrEqual(15);
  });

  test("inserts only missing seed questions without clearing existing records", async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const service = createQuestionBankService(pool);

    await service.seedInitialQuestions();

    const seedCall = pool.query.mock.calls.find(([sql]) => String(sql).includes("WITH seed_questions"));
    expect(seedCall).toBeDefined();
    expect(seedCall[0]).toContain("WHERE NOT EXISTS");
    expect(seedCall[0]).toContain("LOWER(TRIM(existing.question))");
    expect(seedCall[0]).toContain("::boolean");
    expect(seedCall[1]).toHaveLength(SEED_QUESTIONS.length * (5 + EXAMPLE_FIELDS.length));
    expect(pool.query.mock.calls.some(([sql]) => String(sql).includes("DELETE FROM question_bank"))).toBe(false);
  });

  test("gives every seed question non-empty strong and weak examples within the length limit", () => {
    for (const item of SEED_QUESTIONS) {
      for (const field of EXAMPLE_FIELDS) {
        expect({ question: item.question, field, ok: typeof item[field] === "string" && item[field].trim().length > 0 })
          .toEqual({ question: item.question, field, ok: true });
        expect(item[field].length).toBeLessThanOrEqual(2000);
      }
      expect(item.ejemplo_fuerte).not.toBe(item.ejemplo_debil);
    }
  });

  test("sends the examples with each seed question and only fills existing questions without examples", async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await createQuestionBankService(pool).seedInitialQuestions();

    const [sql, values] = pool.query.mock.calls.find(([query]) => String(query).includes("WITH seed_questions"));
    const firstRow = values.slice(0, 5 + EXAMPLE_FIELDS.length);
    expect(firstRow).toEqual([
      SEED_QUESTIONS[0].question,
      SEED_QUESTIONS[0].category,
      SEED_QUESTIONS[0].difficulty,
      SEED_QUESTIONS[0].is_required,
      SEED_QUESTIONS[0].visa_profiles,
      ...EXAMPLE_FIELDS.map((field) => SEED_QUESTIONS[0][field]),
    ]);
    expect(sql).toContain("UPDATE question_bank existing");
    for (const field of EXAMPLE_FIELDS) {
      expect(sql).toContain(`existing.${field} IS NULL`);
    }
    expect(sql).toContain("INSERT INTO question_bank (question, category, difficulty, is_required, visa_profiles, ejemplo_fuerte");
  });
});

describe("random interview questions", () => {
  const rows = [1, 2, 3, 4, 5].map((id) => ({
    id, question: `Pregunta ${id}`, category: "General", activo: true,
  }));

  test("requests the exact count with random ordering and distinct active text", async () => {
    let call = 0;
    const pool = { query: jest.fn(async (sql) => {
      if (!String(sql).includes("FROM eligible")) return { rows: [] };
      call += 1;
      return { rows: call === 1 ? rows.slice(0, 4) : rows.slice(1, 5) };
    }) };
    const service = createQuestionBankService(pool);

    const first = await service.listRandomQuestions({ count: "4", exclude: "intro" });
    const second = await service.listRandomQuestions({ count: "4", exclude: "intro" });

    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    expect(first.map((item) => item.id)).not.toEqual(second.map((item) => item.id));
    expect(new Set(first.map((item) => item.question)).size).toBe(4);
    const [sql, values] = pool.query.mock.calls.find(([query]) => String(query).includes("FROM eligible"));
    expect(sql).toContain("WHERE activo = TRUE");
    expect(sql).toContain("DISTINCT ON (LOWER(TRIM(question)))");
    expect(sql).toContain("ORDER BY RANDOM()");
    expect(sql).toContain("LIMIT $4");
    expect(values).toEqual([[], ["viaje"], null, 4]);
  });

  test("limita las preguntas aleatorias al perfil autenticado", async () => {
    const pool = { query: jest.fn(async (sql) => ({
      rows: String(sql).includes("FROM eligible") ? rows.slice(0, 4) : [],
    })) };

    await createQuestionBankService(pool).listRandomQuestions({ count: "4", profile: "estudiante" });

    const [sql, values] = pool.query.mock.calls.find(([query]) => String(query).includes("FROM eligible"));
    expect(sql).toContain("$5::text = ANY(visa_profiles)");
    expect(values).toEqual([[], [], null, 4, "estudiante"]);
  });

  test("excludes IDs and categories using real bank fields", async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: rows.slice(0, 2) }) };
    const service = createQuestionBankService(pool);
    await service.listRandomQuestions({ count: "2", exclude: "id:7,category:Finanzas,intro" });

    const [sql, values] = pool.query.mock.calls.find(([query]) => String(query).includes("FROM eligible"));
    expect(sql).toContain("id <> ALL($1::int[])");
    expect(sql).toContain("LOWER(TRIM(category)) <> ALL($2::text[])");
    expect(values).toEqual([[7], ["finanzas", "viaje"], null, 2]);
  });

  test("excludes normalized introduction text even outside the Viaje category", async () => {
    const intro = "¿Cuál es su nombre completo y cuál es el propósito de su viaje?";
    const catalog = [
      { id: 41, question: `  ${intro.toUpperCase()}  `, category: "General", activo: true },
      ...rows.slice(0, 4),
    ];
    const pool = { query: jest.fn(async (sql, values) => ({
      rows: String(sql).includes("FROM eligible")
        ? catalog.filter((item) => item.question.trim().toLocaleLowerCase("es") !== values[2].trim().toLocaleLowerCase("es"))
        : [],
    })) };

    const selected = await createQuestionBankService(pool).listRandomQuestions({ count: "4", exclude: "intro", excludeText: intro });
    expect(selected).toHaveLength(4);
    expect(selected.some((item) => item.id === 41)).toBe(false);
    const [sql, values] = pool.query.mock.calls.find(([query]) => String(query).includes("FROM eligible"));
    expect(sql).toContain("LOWER(TRIM(question)) <> LOWER(TRIM($3::text))");
    expect(values).toEqual([[], ["viaje"], intro, 4]);
  });

  test.each(["", " ", "x".repeat(501), ["uno", "dos"], null])(
    "rejects invalid excludeText %j", async (excludeText) => {
      const pool = { query: jest.fn() };
      await expect(createQuestionBankService(pool).listRandomQuestions({ excludeText }))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test("keeps inactive records out of the random result", async () => {
    const catalog = [
      { id: 1, question: "Activa uno", activo: true },
      { id: 2, question: "Inactiva", activo: false },
      { id: 3, question: "Activa dos", activo: true },
    ];
    const pool = { query: jest.fn(async (sql) => ({
      rows: String(sql).includes("FROM eligible")
        ? catalog.filter((item) => String(sql).includes("WHERE activo = TRUE") && item.activo)
        : [],
    })) };

    const selected = await createQuestionBankService(pool).listRandomQuestions({ count: "2" });
    expect(selected.map((item) => item.id)).toEqual([1, 3]);
    expect(selected.some((item) => item.activo === false)).toBe(false);
  });

  test.each(["0", "-1", "1.5", "abc", "21", "", "999999999999999999999"])(
    "rejects invalid count %j before querying", async (count) => {
      const pool = { query: jest.fn() };
      await expect(createQuestionBankService(pool).listRandomQuestions({ count })).rejects.toMatchObject({ statusCode: 400 });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test.each(["id:0", "id:2147483648", "category:Desconocida", "otro", "intro,"])(
    "rejects invalid exclusion %j", async (exclude) => {
      const pool = { query: jest.fn() };
      await expect(createQuestionBankService(pool).listRandomQuestions({ count: "4", exclude })).rejects.toMatchObject({ statusCode: 400 });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test("reports when fewer than the requested eligible questions exist", async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: rows.slice(0, 3) }) };
    await expect(createQuestionBankService(pool).listRandomQuestions({ count: "4", exclude: "intro" }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("se necesitan 4 y hay 3") });
  });
});

describe("question answer examples", () => {
  const basePayload = { question: "¿Quién financiará su viaje?", category: "Finanzas", difficulty: "Media", is_required: true };
  const createPool = () => ({
    query: jest.fn(async (sql) => (/^\s*(INSERT|UPDATE)/.test(String(sql)) ? { rows: [{ id: 7 }] } : { rows: [] })),
  });
  const writeCall = (pool, verb) => pool.query.mock.calls.find(([sql]) => String(sql).trim().startsWith(verb));

  test("adds the example columns to existing databases", async () => {
    const pool = createPool();
    await createQuestionBankService(pool).ensureSchema();

    const alter = pool.query.mock.calls.map(([sql]) => String(sql)).join("\n");
    for (const field of EXAMPLE_FIELDS) {
      expect(alter).toContain(`ADD COLUMN IF NOT EXISTS ${field} TEXT`);
    }
  });

  test("stores trimmed examples on create and null for the missing ones", async () => {
    const pool = createPool();
    await createQuestionBankService(pool).createQuestion({
      ...basePayload,
      ejemplo_fuerte: "  Mi empresa paga el viaje y regreso a trabajar el lunes.  ",
      explicacion_fuerte: "Es concreta y muestra arraigo.",
      ejemplo_debil: "",
    });

    const [sql, values] = writeCall(pool, "INSERT");
    expect(sql).toContain("ejemplo_fuerte, explicacion_fuerte, ejemplo_debil, explicacion_debil");
    expect(sql).toContain("RETURNING id, question");
    expect(values.slice(4)).toEqual([
      "Mi empresa paga el viaje y regreso a trabajar el lunes.",
      "Es concreta y muestra arraigo.",
      null,
      null,
    ]);
  });

  test("keeps existing examples when an update does not send them", async () => {
    const pool = createPool();
    await createQuestionBankService(pool).updateQuestion("7", basePayload);

    const [sql, values] = writeCall(pool, "UPDATE");
    for (const field of EXAMPLE_FIELDS) {
      expect(sql).not.toContain(`${field} =`);
    }
    expect(sql).toContain("WHERE id = $5");
    expect(values).toEqual([basePayload.question, "Finanzas", "Media", true, 7]);
  });

  test("updates only the examples that are sent and clears them with null", async () => {
    const pool = createPool();
    await createQuestionBankService(pool).updateQuestion("7", {
      ...basePayload,
      ejemplo_debil: "No sé, tal vez alguien me ayude.",
      explicacion_debil: null,
    });

    const [sql, values] = writeCall(pool, "UPDATE");
    expect(sql).toContain("ejemplo_debil = $5");
    expect(sql).toContain("explicacion_debil = $6");
    expect(sql).not.toContain("ejemplo_fuerte =");
    expect(sql).toContain("WHERE id = $7");
    expect(values.slice(4)).toEqual(["No sé, tal vez alguien me ayude.", null, 7]);
  });

  test("saves all four examples sent by the admin form and clears the empty ones (SP10-19)", async () => {
    const pool = createPool();
    await createQuestionBankService(pool).updateQuestion("7", {
      ...basePayload,
      ejemplo_fuerte: "  Voy a un congreso y regreso el lunes.  ",
      explicacion_fuerte: "",
      ejemplo_debil: "",
      explicacion_debil: "   ",
    });

    const [sql, values] = writeCall(pool, "UPDATE");
    for (const field of EXAMPLE_FIELDS) {
      expect(sql).toContain(`${field} = $`);
    }
    expect(sql).toContain("WHERE id = $9");
    expect(values.slice(4)).toEqual(["Voy a un congreso y regreso el lunes.", null, null, null, 7]);
  });

  test("accepts examples of exactly 2000 characters and rejects 2001 on update", async () => {
    const service = createQuestionBankService(createPool());

    await expect(service.updateQuestion("7", { ...basePayload, ejemplo_fuerte: "a".repeat(2000) })).resolves.toBeDefined();
    await expect(service.updateQuestion("7", { ...basePayload, ejemplo_fuerte: "a".repeat(2001) }))
      .rejects.toMatchObject({ statusCode: 400, message: "ejemplo_fuerte no puede superar 2000 caracteres" });
  });

  test("rejects non-text or too long examples with 400", async () => {
    const service = createQuestionBankService(createPool());

    await expect(service.createQuestion({ ...basePayload, ejemplo_fuerte: 42 }))
      .rejects.toMatchObject({ statusCode: 400, message: "ejemplo_fuerte debe ser texto" });
    await expect(service.updateQuestion("7", { ...basePayload, explicacion_debil: "a".repeat(2001) }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test("returns the examples when listing questions", async () => {
    const pool = createPool();
    await createQuestionBankService(pool).listQuestions();

    const [sql] = pool.query.mock.calls.find(([query]) => String(query).includes("ORDER BY created_at DESC"));
    for (const field of EXAMPLE_FIELDS) {
      expect(sql).toContain(field);
    }
  });
});
