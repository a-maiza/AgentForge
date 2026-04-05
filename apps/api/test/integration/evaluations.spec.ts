/**
 * Integration tests for the Evaluations REST endpoints.
 */
import '../helpers/env.setup';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EvaluationsModule } from '../../src/evaluations/evaluations.module';
import { EvaluationsService } from '../../src/evaluations/evaluations.service';
import { buildSlimApp, getServer } from '../helpers/app.helper';

const EVAL_ID = 'eval-1';

const mockEval = {
  id: EVAL_ID,
  promptId: 'prompt-1',
  promptVersionId: 'pv-1',
  datasetVersionId: 'dv-1',
  status: 'pending',
  grade: null,
  metrics: ['f1'],
  createdAt: new Date().toISOString(),
};

const mockEvaluationsService = {
  findAll: jest.fn().mockResolvedValue({ items: [mockEval], nextCursor: null }),
  findOne: jest.fn().mockResolvedValue(mockEval),
  create: jest.fn().mockResolvedValue(mockEval),
  remove: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue(mockEval),
  getTraces: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
};

describe('Evaluations (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await buildSlimApp(EvaluationsModule, [
      { token: EvaluationsService, value: mockEvaluationsService },
    ]);
    server = getServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEvaluationsService.findAll.mockResolvedValue({ items: [mockEval], nextCursor: null });
    mockEvaluationsService.findOne.mockResolvedValue(mockEval);
    mockEvaluationsService.create.mockResolvedValue(mockEval);
    mockEvaluationsService.remove.mockResolvedValue(undefined);
    mockEvaluationsService.cancel.mockResolvedValue(mockEval);
    mockEvaluationsService.getTraces.mockResolvedValue({ items: [], nextCursor: null });
  });

  describe('GET /api/evaluations', () => {
    it('returns 200 with items array', async () => {
      const res = await request(server).get('/api/evaluations').expect(200);
      expect(res.body).toHaveProperty('items');
    });
  });

  describe('GET /api/evaluations/:id', () => {
    it('returns 200 with evaluation', async () => {
      const res = await request(server).get(`/api/evaluations/${EVAL_ID}`).expect(200);
      expect(res.body).toHaveProperty('id', EVAL_ID);
    });

    it('returns 404 for unknown id', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockEvaluationsService.findOne.mockRejectedValueOnce(new NotFoundException());
      await request(server).get('/api/evaluations/nonexistent').expect(404);
    });
  });

  describe('POST /api/evaluations', () => {
    it('returns 201 with created evaluation', async () => {
      const res = await request(server)
        .post('/api/evaluations')
        .send({ promptId: 'prompt-1', promptVersionId: 'pv-1', metrics: ['f1'] })
        .expect(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('DELETE /api/evaluations/:id', () => {
    it('returns 204', async () => {
      await request(server).delete(`/api/evaluations/${EVAL_ID}`).expect(204);
    });
  });

  describe('GET /api/evaluations/:id/traces', () => {
    it('returns 200 with traces', async () => {
      const res = await request(server)
        .get(`/api/evaluations/${EVAL_ID}/traces`)
        .expect(200);
      expect(res.body).toBeDefined();
    });
  });
});
