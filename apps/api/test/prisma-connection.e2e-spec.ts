import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

describe('Prisma connection', () => {
  it('conecta y puede contar usuarios', async () => {
    const prisma = new PrismaClient();
    const count = await prisma.user.count();
    expect(count).toBeGreaterThan(0);
    await prisma.$disconnect();
  });
});
