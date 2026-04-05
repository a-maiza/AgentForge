/**
 * Integration tests for the Datasets REST endpoints.
 */
import '../helpers/env.setup';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatasetsModule } from '../../src/datasets/datasets.module';
import { DatasetsService } from '../../src/datasets/datasets.service';
import { WorkspacesService } from '../../src/workspaces/workspaces.service';
import { AuditService } from '../../src/audit/audit.service';
import { buildSlimApp, getServer, FAKE_USER } from '../helpers/app.helper';

const WORKSPACE_ID = '22222222-2222-2222-2222-222222222222';
const DATASET_ID = 'dataset-1';

const mockDataset = {
  id: DATASET_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Test Dataset',
  description: null,
  status: 'active',
  createdBy: FAKE_USER.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  versions: [],
};

const mockDatasetsService = {
  findAll: jest.fn().mockResolvedValue({ items: [mockDataset], nextCursor: null }),
  findOne: jest.fn().mockResolvedValue({ ...mockDataset, versions: [] }),
  create: jest.fn().mockResolvedValue(mockDataset),
  update: jest.fn().mockResolvedValue({ ...mockDataset, name: 'Updated' }),
  delete: jest.fn().mockResolvedValue(undefined),
  getVersions: jest.fn().mockResolvedValue([]),
  upload: jest.fn().mockResolvedValue({
    dataset: mockDataset,
    version: { id: 'v-1', versionNumber: 1, fileSizeBytes: '100' },
  }),
  preview: jest.fn().mockResolvedValue({ columns: ['a', 'b'], rows: [{ a: 1, b: 2 }] }),
  compare: jest.fn().mockResolvedValue({ added: 1, removed: 0, modified: 0 }),
};

const mockWorkspacesService = { getMembership: jest.fn().mockResolvedValue({ id: 'member-1' }) };
const mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };

describe('Datasets (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await buildSlimApp(DatasetsModule, [
      { token: DatasetsService, value: mockDatasetsService },
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
    mockDatasetsService.findAll.mockResolvedValue({ items: [mockDataset], nextCursor: null });
    mockDatasetsService.findOne.mockResolvedValue({ ...mockDataset, versions: [] });
    mockDatasetsService.create.mockResolvedValue(mockDataset);
    mockDatasetsService.update.mockResolvedValue({ ...mockDataset, name: 'Updated' });
    mockDatasetsService.delete.mockResolvedValue(undefined);
    mockDatasetsService.getVersions.mockResolvedValue([]);
    mockDatasetsService.preview.mockResolvedValue({ columns: ['a'], rows: [] });
  });

  describe('GET /api/workspaces/:workspaceId/datasets', () => {
    it('returns 200 with items array', async () => {
      const res = await request(server).get(`/api/workspaces/${WORKSPACE_ID}/datasets`).expect(200);
      expect(res.body).toHaveProperty('items');
    });
  });

  describe('GET /api/workspaces/:workspaceId/datasets/:id', () => {
    it('returns 200 with dataset', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/datasets/${DATASET_ID}`)
        .expect(200);
      expect(res.body).toHaveProperty('id', DATASET_ID);
    });
  });

  describe('POST /api/workspaces/:workspaceId/datasets', () => {
    it('returns 201 with created dataset', async () => {
      const res = await request(server)
        .post(`/api/workspaces/${WORKSPACE_ID}/datasets`)
        .send({ name: 'New Dataset', workspaceId: WORKSPACE_ID })
        .expect(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('PUT /api/workspaces/:workspaceId/datasets/:id', () => {
    it('returns 200 with updated dataset', async () => {
      const res = await request(server)
        .put(`/api/workspaces/${WORKSPACE_ID}/datasets/${DATASET_ID}`)
        .send({ name: 'Updated' })
        .expect(200);
      expect(res.body).toHaveProperty('name', 'Updated');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/datasets/:id', () => {
    it('returns 204', async () => {
      await request(server)
        .delete(`/api/workspaces/${WORKSPACE_ID}/datasets/${DATASET_ID}`)
        .expect(204);
    });
  });

  describe('GET /api/workspaces/:workspaceId/datasets/:id/versions', () => {
    it('returns 200 with versions array', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/datasets/${DATASET_ID}/versions`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/workspaces/:workspaceId/datasets/:id/versions/:versionNumber/preview', () => {
    it('returns 200 with columns and rows', async () => {
      const res = await request(server)
        .get(`/api/workspaces/${WORKSPACE_ID}/datasets/${DATASET_ID}/versions/1/preview`)
        .expect(200);
      expect(res.body).toHaveProperty('columns');
      expect(res.body).toHaveProperty('rows');
    });
  });
});
