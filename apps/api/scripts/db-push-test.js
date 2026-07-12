// Ejecuta `prisma db push` usando EXCLUSIVAMENTE las variables de entorno
// de `.env.test` (schema Postgres "test", jamas produccion). Imprime el
// DATABASE_URL enmascarado antes de proceder y aborta si no contiene
// "schema=test", como salvaguarda adicional.
const { config } = require('dotenv');
const { spawnSync } = require('child_process');
const path = require('path');

const result = config({ path: path.join(__dirname, '..', '.env.test') });
if (result.error) {
  throw result.error;
}

const url = process.env.DATABASE_URL || '';
const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log('[db-push-test] DATABASE_URL (masked):', masked);

if (!/[?&]schema=test(&|$)/.test(url)) {
  console.error(
    '[db-push-test] ABORTADO: DATABASE_URL no contiene "schema=test". Rehuso continuar.',
  );
  process.exit(1);
}

const res = spawnSync('npx', ['prisma', 'db', 'push'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(res.status ?? 1);
