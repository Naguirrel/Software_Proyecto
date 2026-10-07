const {
  CATEGORIES,
  DIFFICULTIES,
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
    expect(seedCall[1]).toHaveLength(SEED_QUESTIONS.length * 4);
    expect(pool.query.mock.calls.some(([sql]) => String(sql).includes("DELETE FROM question_bank"))).toBe(false);
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
