// Siembra las cuentas demo (un usuario por rol) en la base LOCAL.
//
// Usa apps/api/.env y aborta si DATABASE_URL no apunta a localhost, para no
// tocar nunca una base remota (Neon/producción) por accidente.
//
// Uso: node scripts/seed-local.js
// Todas las cuentas quedan con la contraseña: password

const { config } = require('dotenv');
const path = require('path');

config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log('[seed-local] DATABASE_URL (masked):', masked);

let host = '';
try {
  host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
} catch {
  host = '';
}
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`[seed-local] ABORTADO: el host "${host}" no es local. Rehuso continuar.`);
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
    console.log(`\nListo. Todas con contraseña: ${PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
