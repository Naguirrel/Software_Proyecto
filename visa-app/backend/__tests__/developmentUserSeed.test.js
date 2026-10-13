const bcrypt = require("bcrypt");
const { seedDevelopmentUsers } = require("../services/developmentUserSeed");

const users = [
  { nombre: "Cliente", correo: "cliente@example.test", rol: "cliente", passwordHash: bcrypt.hashSync("a strong replacement password", 4) },
  { nombre: "Admin", correo: "admin@example.test", rol: "admin", passwordHash: bcrypt.hashSync("a different strong password", 4) },
];

test("inserts seed users using their bcrypt hashes", async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };

  await seedDevelopmentUsers(pool, users);

  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO usuario"), [
    "Cliente", users[0].correo, users[0].passwordHash, "cliente",
    "Admin", users[1].correo, users[1].passwordHash, "admin",
  ]);
  expect(pool.query).toHaveBeenCalledTimes(2);
});

test("replaces only old default passwords on existing users", async () => {
  const oldHash = bcrypt.hashSync("123456", 4);
  const customHash = bcrypt.hashSync("already changed privately", 4);
  const pool = { query: jest.fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [
      { id_usuario: 1, correo: users[0].correo, contrasena: oldHash },
      { id_usuario: 2, correo: users[1].correo, contrasena: customHash },
    ] })
    .mockResolvedValueOnce({ rowCount: 1 }) };

  await seedDevelopmentUsers(pool, users);

  expect(pool.query).toHaveBeenCalledTimes(3);
  expect(pool.query).toHaveBeenLastCalledWith(
    expect.stringContaining("UPDATE usuario SET contrasena"),
    [users[0].passwordHash, 1, oldHash]
  );
});
