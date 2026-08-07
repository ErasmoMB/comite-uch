// Script auxiliar de una sola vez: crea el schema Postgres "test" dentro de
// la MISMA base/instancia Neon que usa produccion. Es una operacion
// aditiva (CREATE SCHEMA IF NOT EXISTS) que NO toca ni modifica el schema
// "public" (donde viven las 12 tablas reales con datos de produccion).
// Se conecta usando el DATABASE_URL de `.env` (produccion) precisamente
// porque necesita crear un schema nuevo en esa misma base; no borra ni
// altera ninguna tabla existente.
require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no definido en .env');
  }
  const masked = url.replace(/:[^:@/]+@/, ':****@');
  console.log('[create-test-schema] Conectando a:', masked);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS test;');
    console.log('[create-test-schema] Schema "test" creado (o ya existia).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
