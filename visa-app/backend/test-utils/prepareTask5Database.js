const { Pool } = require("pg");
const { requireTestConfiguration, prepareTestSchema } = require("./postgresTask5Harness");

async function main() {
  requireTestConfiguration();
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await prepareTestSchema(pool);
    process.stdout.write("Test database identity verified; init.sql applied.\n");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Test database preparation failed: ${error.message}\n`);
  process.exitCode = 1;
});
