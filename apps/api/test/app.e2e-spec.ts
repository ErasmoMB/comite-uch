import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AppModule as AppModuleType } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    // Carga .env.test ANTES de importar AppModule (mismo patron que el resto
    // de los specs) - sin esto, el orden de ejecucion de los archivos decide
    // si SECRET_KEY/DATABASE_URL ya estan en process.env o no. require()
    // diferido (no import estatico) para que la carga ocurra despues de
    // loadEnv(), ya que ts-jest/CommonJS no soporta import() dinamico aqui.
    loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });
    const { AppModule } = require('./../src/app.module') as { AppModule: typeof AppModuleType };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
