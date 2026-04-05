/**
 * Integration tests for the API Keys REST endpoints.
 */
import '../helpers/env.setup';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiKeysModule } from '../../src/api-keys/api-keys.module';
import { ApiKeysService } from '../../src/api-keys/api-keys.service';
import { WorkspacesService } from '../../src/workspaces/workspaces.service';
import { AuditService } from '../../src/audit/audit.service';
import { buildSlimApp, getServer } from '../helpers/app.helper';

const WORKSPACE_ID = 'ws-apikeys-test';
const KEY_ID = 'key-1';

const mockApiKey = {
  id: KEY_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Test Key',
  keyPrefix: 'sk-test',
  status: 'active',
  createdAt: new Date().toISOString(),
  expiresAt: null,
};

const mockApiKeysService = {
  findAll: jest.fn().mockResolvedValue([mockApiKey]),
  findOne: jest.fn().mockResolvedValue(mockApiKey),
  create: jest.fn().mockResolvedValue({ ...mockApiKey, plaintextKey: 'sk-test-full-key' }),
  disable: jest.fn().mockResolvedValue({ ...mockApiKey, status: 'disabled' }),
  remove: jest.fn().mockResolvedValue(undefined),
};

const mockWorkspacesService = { getMembership: jest.fn().mockResolvedValue({ id: 'member-1' }) };
const mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };

describe('API Keys (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await buildSlimApp(ApiKeysModule, [
      { token: ApiKeysService, value: mockApiKeysService },
      { token: WorkspacesService, value: mockWorkspacesService },
      { token: AuditService, value: mockAuditService },
    ]);
    server = getServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeysService.findAll.mockResolvedValue([mockApiKey]);
    mockApiKeysService.create.mockResolvedValue({ ...mockApiKey, plaintextKey: 'sk-test-full-key' });
    mockApiKeysService.disable.mockResolvedValue({ ...mockApiKey, status: 'disabled' });
    mockApiKeysService.remove.mockResolvedValue(undefined);
  });

  describe('GET /api/workspaces/:workspaceId/api-keys', () => {
    it('returns 200 with array of keys', async () => {
      const res = await request(server).get(`/api/workspaces/${WORKSPACE_ID}/api-keys`).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/workspaces/:workspaceId/api-keys', () => {
    it('returns 201 with created key including plaintextKey', async () => {
      const res = await request(server)
        .post(`/api/workspaces/${WORKSPACE_ID}/api-keys`)
        .send({ name: 'New Key' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('PATCH /api/workspaces/:workspaceId/api-keys/:id/disable', () => {
    it('returns 200 with disabled key', async () => {
      const res = await request(server)
        .patch(`/api/workspaces/${WORKSPACE_ID}/api-keys/${KEY_ID}/disable`)
        .expect(200);
      expect(res.body).toHaveProperty('status', 'disabled');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/api-keys/:id', () => {
    it('returns 204', async () => {
      await request(server)
        .delete(`/api/workspaces/${WORKSPACE_ID}/api-keys/${KEY_ID}`)
        .expect(204);
    });
  });
});
