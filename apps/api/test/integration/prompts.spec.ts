/**
 * Integration tests for the Prompts REST endpoints.
 * Uses a slim module (no AppModule, no global auth guard).
 */
import '../helpers/env.setup';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PromptsModule } from '../../src/prompts/prompts.module';
import { PromptsService } from '../../src/prompts/prompts.service';
import { WorkspacesService } from '../../src/workspaces/workspaces.service';
import { buildSlimApp, getServer, FAKE_USER } from '../helpers/app.helper';

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const PROMPT_ID = 'prompt-1';

const mockPrompt = {
  id: PROMPT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Test Prompt',
  description: null,
  content: 'Hello {{name}}',
  status: 'draft',
  isLive: false,
  liveVersionId: null,
  endpointHash: null,
  createdBy: FAKE_USER.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPromptsService = {
  findAll: jest.fn().mockResolvedValue({ items: [mockPrompt], nextCursor: null }),
  findOne: jest.fn().mockResolvedValue({ ...mockPrompt, versions: [], variables: [] }),
  create: jest.fn().mockResolvedValue(mockPrompt),
  update: jest.fn().mockResolvedValue({ ...mockPrompt, name: 'Updated' }),
  delete: jest.fn().mockResolvedValue(undefined),
  getVersions: jest.fn().mockResolvedValue([]),
  getVersion: jest.fn().mockResolvedValue({ id: 'v-1', versionNumber: 1 }),
  compareVersions: jest.fn().mockResolvedValue({ added: 0, removed: 0, modified: 1 }),
  getDatasetConfig: jest.fn().mockResolvedValue(null),
  saveDatasetConfig: jest.fn().mockResolvedValue({}),
  regressionTest: jest.fn().mockResolvedValue({ improved: true }),
};

const mockWorkspacesService = { getMembership: jest.fn().mockResolvedValue({ id: 'member-1' }) };

describe('Prompts (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await buildSlimApp(PromptsModule, [
      { token: PromptsService, value: mockPromptsService },
      { token: WorkspacesService, value: mockWorkspacesService },
    ]);
    server = getServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPromptsService.findAll.mockResolvedValue({ items: [mockPrompt], nextCursor: null });
    mockPromptsService.findOne.mockResolvedValue({ ...mockPrompt, versions: [], variables: [] });
    mockPromptsService.create.mockResolvedValue(mockPrompt);
    mockPromptsService.update.mockResolvedValue({ ...mockPrompt, name: 'Updated' });
    mockPromptsService.delete.mockResolvedValue(undefined);
    mockPromptsService.getVersions.mockResolvedValue([]);
    mockPromptsService.getVersion.mockResolvedValue({ id: 'v-1', versionNumber: 1 });
  });

  describe('GET /api/workspaces/:workspaceId/prompts', () => {
    it('returns 200 with items array', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/prompts`)
        .expect(200);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('calls PromptsService.findAll with workspaceId', async () => {
      await request(server).get(`/api/workspaces/${WORKSPACE_ID}/prompts`);
      expect(mockPromptsService.findAll).toHaveBeenCalledWith(WORKSPACE_ID, undefined, undefined);
    });
  });

  describe('GET /api/workspaces/:workspaceId/prompts/:id', () => {
    it('returns 200 with prompt data', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/prompts/${PROMPT_ID}`)
        .expect(200);
      expect(res.body).toHaveProperty('id', PROMPT_ID);
    });

    it('returns 404 when service throws NotFoundException', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockPromptsService.findOne.mockRejectedValueOnce(new NotFoundException('Not found'));
      await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/prompts/nonexistent`)
        .expect(404);
    });
  });

  describe('POST /api/workspaces/:workspaceId/prompts', () => {
    it('returns 201 with created prompt', async () => {
      const res = await request(server)
        .post(`/api/workspaces/${WORKSPACE_ID}/prompts`)
        .send({ name: 'New Prompt', content: 'Content {{var}}', workspaceId: WORKSPACE_ID })
        .expect(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 for invalid body', async () => {
      await request(server)
        .post(`/api/workspaces/${WORKSPACE_ID}/prompts`)
        .send({})
        .expect(400);
    });
  });

  describe('PUT /api/workspaces/:workspaceId/prompts/:id', () => {
    it('returns 200 with updated prompt', async () => {
      const res = await request(server)
        .put(`/api/workspaces/${WORKSPACE_ID}/prompts/${PROMPT_ID}`)
        .send({ name: 'Updated' })
        .expect(200);
      expect(res.body).toHaveProperty('name', 'Updated');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/prompts/:id', () => {
    it('returns 204', async () => {
      await request(server)
        .delete(`/api/workspaces/${WORKSPACE_ID}/prompts/${PROMPT_ID}`)
        .expect(204);
    });
  });

  describe('GET /api/workspaces/:workspaceId/prompts/:id/versions', () => {
    it('returns 200 with versions array', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/prompts/${PROMPT_ID}/versions`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
