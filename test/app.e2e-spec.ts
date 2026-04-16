import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, RequestMethod } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';

const SKIP_E2E = !process.env['DATABASE_URL'] || process.env['SKIP_E2E'] === 'true';

(SKIP_E2E ? describe.skip : describe)('Uptime Pro API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Dynamic import to avoid loading AppModule (and its ESM deps) when skipping
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Auth', () => {
    it('POST /api/v1/auth/register returns 201 or 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username: 'e2euser', password: 'E2ePassword1!' });
      expect([201, 409]).toContain(res.status);
    });

    it('POST /api/v1/auth/login returns 200 with cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'e2euser', password: 'E2ePassword1!' });
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('GET /api/v1/auth/me returns 401 without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Monitors', () => {
    let cookie: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'e2euser', password: 'E2ePassword1!' });
      cookie = loginRes.headers['set-cookie']?.[0] ?? '';
    });

    it('GET /api/v1/monitors requires auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/monitors');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/monitors returns 200 when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/monitors')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/v1/monitors creates monitor', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/monitors')
        .set('Cookie', cookie)
        .send({
          name: 'E2E Test Monitor',
          type: 'http',
          interval: 60,
          config: { url: 'https://example.com', method: 'GET', expectedStatus: 200 },
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('E2E Test Monitor');
    });

    it('POST /api/v1/monitors validates DTO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/monitors')
        .set('Cookie', cookie)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('Notifications', () => {
    let cookie: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'e2euser', password: 'E2ePassword1!' });
      cookie = loginRes.headers['set-cookie']?.[0] ?? '';
    });

    it('GET /api/v1/notifications returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/notifications creates notification channel', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Cookie', cookie)
        .send({
          name: 'Test Webhook',
          type: 'webhook',
          config: { webhookUrl: 'https://hooks.example.com/test' },
        });
      expect(res.status).toBe(201);
    });
  });

  describe('Badge endpoints (public)', () => {
    it('GET /api/v1/badge/1/status returns SVG or 404', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/badge/1/status');
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers['content-type']).toMatch(/svg/);
      }
    });
  });

  describe('Status pages (public)', () => {
    it('GET /api/v1/status-pages/public/nonexistent returns 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/status-pages/public/nonexistent-slug-xyz');
      expect(res.status).toBe(404);
    });
  });
});
