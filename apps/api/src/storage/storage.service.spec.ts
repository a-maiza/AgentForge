import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

// Mock S3Client to avoid real AWS connections
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((args) => ({ _type: 'PutObject', ...args })),
  GetObjectCommand: jest.fn().mockImplementation((args) => ({ _type: 'GetObject', ...args })),
  DeleteObjectCommand: jest.fn().mockImplementation((args) => ({ _type: 'Delete', ...args })),
}));

const mockConfig = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      USE_MINIO: 'true',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'test-bucket',
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin',
      AWS_REGION: 'us-east-1',
    };
    return values[key];
  }),
  getOrThrow: jest.fn(),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    service = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  describe('buildKey', () => {
    it('builds the correct S3 key path', () => {
      const key = service.buildKey('ws-1', 'ds-1', 3, 'data.csv');
      expect(key).toBe('datasets/ws-1/ds-1/v3/data.csv');
    });
  });

  describe('upload', () => {
    it('sends a PutObjectCommand with correct params', async () => {
      mockSend.mockResolvedValue({});
      const buf = Buffer.from('hello');
      await service.upload('datasets/ws/ds/v1/file.csv', buf, 'text/csv');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'PutObject' }),
      );
    });
  });

  describe('getBuffer', () => {
    it('reads stream into a buffer', async () => {
      const readable = Readable.from([Buffer.from('hello'), Buffer.from(' world')]);
      mockSend.mockResolvedValue({ Body: readable });
      const buf = await service.getBuffer('some/key');
      expect(buf.toString()).toBe('hello world');
    });
  });

  describe('delete', () => {
    it('sends a DeleteObjectCommand', async () => {
      mockSend.mockResolvedValue({});
      await service.delete('some/key');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'Delete' }),
      );
    });
  });
});
