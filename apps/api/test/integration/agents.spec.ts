/**
 * Integration tests for the Agents REST endpoints.
 */
import '../helpers/env.setup';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AgentsModule } from '../../src/agents/agents.module';
import { AgentsService } from '../../src/agents/agents.service';
import { WorkspacesService } from '../../src/workspaces/workspaces.service';
import { buildSlimApp, getServer, FAKE_USER } from '../helpers/app.helper';

const WORKSPACE_ID = 'ws-agents-test';
const AGENT_ID = 'agent-1';

const mockAgent = {
  id: AGENT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Test Agent',
  description: null,
  workflowDefinition: null,
  status: 'draft',
  createdBy: FAKE_USER.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAgentsService = {
  findAll: jest.fn().mockResolvedValue({ items: [mockAgent], nextCursor: null }),
  findOne: jest.fn().mockResolvedValue(mockAgent),
  create: jest.fn().mockResolvedValue(mockAgent),
  update: jest.fn().mockResolvedValue({ ...mockAgent, name: 'Updated' }),
  delete: jest.fn().mockResolvedValue(undefined),
  updateWorkflow: jest.fn().mockResolvedValue(mockAgent),
  testRun: jest.fn().mockResolvedValue({ success: true, output: 'ok', traces: [] }),
};

const mockWorkspacesService = { getMembership: jest.fn().mockResolvedValue({ id: 'member-1' }) };

describe('Agents (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await buildSlimApp(AgentsModule, [
      { token: AgentsService, value: mockAgentsService },
      { token: WorkspacesService, value: mockWorkspacesService },
    ]);
    server = getServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentsService.findAll.mockResolvedValue({ items: [mockAgent], nextCursor: null });
    mockAgentsService.findOne.mockResolvedValue(mockAgent);
    mockAgentsService.create.mockResolvedValue(mockAgent);
    mockAgentsService.update.mockResolvedValue({ ...mockAgent, name: 'Updated' });
    mockAgentsService.delete.mockResolvedValue(undefined);
    mockAgentsService.updateWorkflow.mockResolvedValue(mockAgent);
    mockAgentsService.testRun.mockResolvedValue({ success: true, output: 'ok', traces: [] });
  });

  describe('GET /api/workspaces/:workspaceId/agents', () => {
    it('returns 200 with items array', async () => {
      const res = await request(server).get(`/api/workspaces/${WORKSPACE_ID}/agents`).expect(200);
      expect(res.body).toHaveProperty('items');
    });
  });

  describe('GET /api/workspaces/:workspaceId/agents/:id', () => {
    it('returns 200 with agent', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/agents/${AGENT_ID}`)
        .expect(200);
      expect(res.body).toHaveProperty('id', AGENT_ID);
    });

    it('returns 404 for unknown id', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockAgentsService.findOne.mockRejectedValueOnce(new NotFoundException());
      await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/agents/nonexistent`)
        .expect(404);
    });
  });

  describe('POST /api/workspaces/:workspaceId/agents', () => {
    it('returns 201 with created agent', async () => {
      const res = await request(server)
        .post(`/api/workspaces/${WORKSPACE_ID}/agents`)
        .send({ name: 'New Agent' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('PUT /api/workspaces/:workspaceId/agents/:id', () => {
    it('returns 200 with updated agent', async () => {
      const res = await request(server)
        .put(`/api/workspaces/${WORKSPACE_ID}/agents/${AGENT_ID}`)
        .send({ name: 'Updated' })
        .expect(200);
      expect(res.body).toHaveProperty('name', 'Updated');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/agents/:id', () => {
    it('returns 204', async () => {
      await request(server)
        .delete(`/api/workspaces/${WORKSPACE_ID}/agents/${AGENT_ID}`)
        .expect(204);
    });
  });

  describe('POST /api/workspaces/:workspaceId/agents/:id/test-run', () => {
    it('returns 201 with test run result', async () => {
      const res = await request(server)
        .post(`/api/workspaces/${WORKSPACE_ID}/agents/${AGENT_ID}/test-run`)
        .send({ input: 'hello' })
        .expect(201);
      expect(res.body).toHaveProperty('success');
    });
  });
});
