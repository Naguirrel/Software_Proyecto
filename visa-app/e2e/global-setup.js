const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const { DB, ADMIN, ADVISOR } = require("./env");

// Crea (o restablece) el administrador y el asesor del E2E con contraseñas conocidas.
// El backend ya inició y aplicó su esquema, así que la tabla `usuario` está completa.
async function upsertStaff(client, user) {
  const hash = await bcrypt.hash(user.contrasena, 10);
  await client.query(
    `INSERT INTO usuario (nombre, correo, contrasena, rol, activo, email_verificado)
     VALUES ($1, $2, $3, $4, TRUE, TRUE)
     ON CONFLICT (correo) DO UPDATE
       SET contrasena = EXCLUDED.contrasena, rol = EXCLUDED.rol, activo = TRUE, email_verificado = TRUE`,
    [user.nombre, user.correo, hash, user.rol]
  );
}

module.exports = async () => {
  const client = new Client(DB);
  await client.connect();
  try {
    await upsertStaff(client, ADMIN);
    await upsertStaff(client, ADVISOR);
    // Un asesor nuevo no debe tener bloqueos de intentos fallidos de ejecuciones anteriores.
    await client.query(
      "DELETE FROM login_attempts WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE correo = ANY($1))",
      [[ADMIN.correo, ADVISOR.correo]]
    );
  } finally {
    await client.end();
  }
};
