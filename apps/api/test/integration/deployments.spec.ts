/**
 * Integration tests for the Deployments REST endpoints.
 * Controller base: api/prompts/:id
 */
import '../helpers/env.setup';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DeploymentsModule } from '../../src/deployments/deployments.module';
import { DeploymentsService } from '../../src/deployments/deployments.service';
import { buildSlimApp, getServer, FAKE_USER } from '../helpers/app.helper';

const PROMPT_ID = 'prompt-1';
const DEPLOYMENT_ID = 'deploy-1';

const mockDeployment = {
  id: DEPLOYMENT_ID,
  promptId: PROMPT_ID,
  promptVersionId: 'pv-1',
  environment: 'dev',
  status: 'active',
  version: '1.0.0.1',
  isLive: false,
  deployedBy: FAKE_USER.id,
  deployedAt: new Date().toISOString(),
};

const mockDeploymentsService = {
  findAll: jest.fn().mockResolvedValue({ current: mockDeployment, history: [mockDeployment] }),
  findHistory: jest.fn().mockResolvedValue([mockDeployment]),
  deploy: jest.fn().mockResolvedValue(mockDeployment),
  promote: jest.fn().mockResolvedValue({ ...mockDeployment, environment: 'staging' }),
  rollback: jest.fn().mockResolvedValue({ ...mockDeployment, status: 'rolled_back' }),
  goLive: jest.fn().mockResolvedValue({ ...mockDeployment, isLive: true }),
};

describe('Deployments (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await buildSlimApp(DeploymentsModule, [
      { token: DeploymentsService, value: mockDeploymentsService },
    ]);
    server = getServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeploymentsService.findAll.mockResolvedValue({ current: mockDeployment, history: [mockDeployment] });
    mockDeploymentsService.findHistory.mockResolvedValue([mockDeployment]);
    mockDeploymentsService.deploy.mockResolvedValue(mockDeployment);
    mockDeploymentsService.promote.mockResolvedValue({ ...mockDeployment, environment: 'staging' });
    mockDeploymentsService.rollback.mockResolvedValue({ ...mockDeployment, status: 'rolled_back' });
    mockDeploymentsService.goLive.mockResolvedValue({ ...mockDeployment, isLive: true });
  });

  describe('GET /api/prompts/:id/deployments', () => {
    it('returns 200 with deployments', async () => {
      const res = await request(server)
        .get(`/api/prompts/${PROMPT_ID}/deployments`)
        .expect(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/prompts/:id/deployments/history', () => {
    it('returns 200 with history array', async () => {
      const res = await request(server)
        .get(`/api/prompts/${PROMPT_ID}/deployments/history`)
        .expect(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('POST /api/prompts/:id/deploy', () => {
    it('returns 201 with created deployment', async () => {
      const res = await request(server)
        .post(`/api/prompts/${PROMPT_ID}/deploy`)
        .send({ promptVersionId: 'pv-1', environment: 'dev' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('POST /api/prompts/:id/promote', () => {
    it('returns 200 with promoted deployment', async () => {
      const res = await request(server)
        .post(`/api/prompts/${PROMPT_ID}/promote`)
        .send({ fromEnvironment: 'dev', toEnvironment: 'staging' })
        .expect(200);
      expect(res.body).toHaveProperty('environment', 'staging');
    });
  });

  describe('POST /api/prompts/:id/rollback/:environment', () => {
    it('returns 200 with rolled back deployment', async () => {
      const res = await request(server)
        .post(`/api/prompts/${PROMPT_ID}/rollback/dev`)
        .expect(200);
      expect(res.body).toHaveProperty('status', 'rolled_back');
    });
  });

  describe('POST /api/prompts/:id/go-live/:environment', () => {
    it('returns 200 with live deployment', async () => {
      const res = await request(server)
        .post(`/api/prompts/${PROMPT_ID}/go-live/dev`)
        .expect(200);
      expect(res.body).toHaveProperty('isLive', true);
    });
  });
});
