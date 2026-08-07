// Seed de usuarios demo para probar el flujo completo (los 5 roles) SOLO
// contra el schema Postgres "test" (nunca produccion). Usa EXCLUSIVAMENTE
// las variables de entorno de `.env.test` y aborta si el DATABASE_URL no
// contiene "schema=test", misma salvaguarda que scripts/db-push-test.js.
//
// Uso: node scripts/seed-test.js
// Crea/actualiza un usuario por rol, todos con la contraseña: password

const { config } = require('dotenv');
const path = require('path');

// override:true es necesario porque `require('@prisma/client')` autocarga
// `.env` (produccion) internamente; sin override, esta llamada no podria
// reemplazar ese valor y el script terminaria apuntando a produccion.
const result = config({
  path: path.join(__dirname, '..', '.env.test'),
  override: true,
});
if (result.error) {
  throw result.error;
}

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log('[seed-test] DATABASE_URL (masked):', masked);

if (!/[?&]schema=test(&|$)/.test(url)) {
  console.error(
    '[seed-test] ABORTADO: DATABASE_URL no contiene "schema=test". Rehuso continuar.',
  );
  process.exit(1);
}

const PASSWORD = 'password';

// (email, rol, nombre, apellido, extra)
const DEMO_USERS = [
  ['pregrado@uch.edu.pe', 'estudiante_pregrado', 'Pamela', 'Pregrado', { codigoEstudiante: '25115013' }],
  ['postgrado@uch.edu.pe', 'estudiante_postgrado', 'Pablo', 'Postgrado', { codigoEstudiante: '23108742' }],
  ['investigador@uch.edu.pe', 'investigador', 'Ivan', 'Investigador', { laboratorio: 'Lab Central' }],
  ['secretaria@uch.edu.pe', 'secretaria', 'Sofia', 'Secretaria', {}],
  ['coordinador@uch.edu.pe', 'coordinador', 'Carlos', 'Coordinador', {}],
  ['evaluador@uch.edu.pe', 'evaluador', 'Elena', 'Evaluadora', { especialidad: 'Bioética', cargaTrabajo: 0 }],
  ['admin@uch.edu.pe', 'administrador', 'Andrea', 'Admin', {}],
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    for (const [email, rol, nombre, apellido, extra] of DEMO_USERS) {
      const user = await prisma.user.upsert({
        where: { email },
        update: { rol, passwordHash, activo: true, ...extra },
        create: { email, rol, nombre, apellido, passwordHash, activo: true, ...extra },
      });
      console.log(`  [ok] ${rol.padEnd(22)} -> ${user.email}`);
    }
    console.log(`\nListo. Todos con contraseña: ${PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
