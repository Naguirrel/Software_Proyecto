const bcrypt = require("bcrypt");

// Only replace the two passwords used by older development seeds. Preserve a
// password that someone has changed independently of the seed.
const LEGACY_PASSWORDS = ["123456", "VisaGuide-Dev-2026!"];

async function hasLegacyPassword(storedPassword) {
  if (LEGACY_PASSWORDS.includes(storedPassword)) return true;
  if (!/^\$2[aby]\$/.test(storedPassword || "")) return false;
  for (const password of LEGACY_PASSWORDS) {
    if (await bcrypt.compare(password, storedPassword)) return true;
  }
  return false;
}

async function seedDevelopmentUsers(pool, users) {
  const values = users.flatMap(({ nombre, correo, passwordHash, rol }) =>
    [nombre, correo, passwordHash, rol]
  );

  await pool.query(
    `INSERT INTO usuario(nombre, correo, contrasena, rol)
     SELECT seed.nombre, seed.correo, seed.contrasena, seed.rol
     FROM (VALUES ${users.map((_, index) => {
       const base = index * 4;
       return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
     }).join(", ")}) AS seed(nombre, correo, contrasena, rol)
     WHERE NOT EXISTS (SELECT 1 FROM usuario u WHERE u.correo = seed.correo)`,
    values
  );

  const existing = await pool.query(
    "SELECT id_usuario, correo, contrasena FROM usuario WHERE correo = ANY($1::text[])",
    [users.map(({ correo }) => correo)]
  );
  const usersByEmail = new Map(users.map((user) => [user.correo, user]));

  for (const row of existing.rows) {
    const user = usersByEmail.get(row.correo);
    if (user && await hasLegacyPassword(row.contrasena)) {
      await pool.query(
        "UPDATE usuario SET contrasena = $1, updated_at = CURRENT_TIMESTAMP WHERE id_usuario = $2 AND contrasena = $3",
        [user.passwordHash, row.id_usuario, row.contrasena]
      );
    }
  }
}

module.exports = { seedDevelopmentUsers };
