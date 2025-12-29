import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Создаем тестовый модуль
    // В реальных тестах нужно настроить тестовую БД
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api', () => {
    it('should return service root', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('@odata.context');
          expect(res.body).toHaveProperty('value');
        });
    });
  });

  describe('GET /api/$metadata', () => {
    it('should return XML metadata', () => {
      return request(app.getHttpServer())
        .get('/api/$metadata')
        .expect(200)
        .expect('Content-Type', /application\/xml/)
        .expect((res) => {
          expect(res.text).toContain('<?xml');
          expect(res.text).toContain('edmx:Edmx');
        });
    });
  });

  describe('OPTIONS', () => {
    it('should handle OPTIONS request for CORS', () => {
      return request(app.getHttpServer())
        .options('/api/test')
        .expect(204)
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBeDefined();
          expect(res.headers['access-control-allow-methods']).toBeDefined();
        });
    });
  });
});


