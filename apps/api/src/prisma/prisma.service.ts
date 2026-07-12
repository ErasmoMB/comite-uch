import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    const url = new URL(process.env.DATABASE_URL ?? '');
    console.log(`[DB] Conectado a: ${url.host}${url.pathname}`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
