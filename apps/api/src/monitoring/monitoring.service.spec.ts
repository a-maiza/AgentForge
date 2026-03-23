import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const mRedis = {
    on: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    publish: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  return { Redis: jest.fn(() => mRedis) };
});

const mockPrisma = {
  apiCallLog: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  evaluationJob: {
    findMany: jest.fn(),
  },
  prompt: {
    findUnique: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

describe('MonitoringService', () => {
  let service: MonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonitoringService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('returns aggregated summary for a workspace', async () => {
      mockPrisma.apiCallLog.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90) // success
        .mockResolvedValueOnce(5); // failover
      mockPrisma.apiCallLog.aggregate.mockResolvedValue({
        _avg: { latencyMs: 250 },
        _sum: { inputTokens: 1000, outputTokens: 500, costUsd: 0.05 },
      });

      const result = await service.getSummary('ws-1', { window: '1h' });

      expect(result.totalCalls).toBe(100);
      expect(result.successCalls).toBe(90);
      expect(result.errorCalls).toBe(10);
      expect(result.successRate).toBeCloseTo(0.9);
      expect(result.avgLatencyMs).toBe(250);
      expect(result.totalTokens).toBe(1500);
      expect(result.failoverCalls).toBe(5);
    });

    it('returns successRate of 1 when totalCalls is 0', async () => {
      mockPrisma.apiCallLog.count.mockResolvedValue(0);
      mockPrisma.apiCallLog.aggregate.mockResolvedValue({
        _avg: { latencyMs: null },
        _sum: { inputTokens: null, outputTokens: null, costUsd: null },
      });

      const result = await service.getSummary('ws-1', {});
      expect(result.successRate).toBe(1);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCostUsd).toBe(0);
    });
  });

  describe('getTimeseries', () => {
    it('maps raw SQL rows to TimeseriesBucket', async () => {
      const now = new Date();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          bucket: now,
          calls: BigInt(10),
          success_calls: BigInt(8),
          avg_latency_ms: 120.5,
          total_tokens: BigInt(500),
          total_cost_usd: 0.01,
        },
      ]);

      const result = await service.getTimeseries('ws-1', {});
      expect(result).toHaveLength(1);
      const bucket = result.at(0)!;
      expect(bucket.calls).toBe(10);
      expect(bucket.successCalls).toBe(8);
      expect(bucket.avgLatencyMs).toBe(121);
      expect(bucket.totalTokens).toBe(500);
    });
  });

  describe('getApiCallsBreakdown', () => {
    it('maps raw SQL rows to ApiCallEndpoint array', async () => {
      const lastCall = new Date();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          endpoint_hash: 'abc123',
          prompt_name: 'My Prompt',
          environment: 'prod',
          total_calls: BigInt(50),
          success_calls: BigInt(45),
          avg_latency_ms: 300,
          last_call_at: lastCall,
          total_cost_usd: 0.25,
          total_tokens: BigInt(2000),
        },
      ]);

      const result = await service.getApiCallsBreakdown('ws-1', {});
      expect(result).toHaveLength(1);
      const endpoint = result.at(0)!;
      expect(endpoint.endpointHash).toBe('abc123');
      expect(endpoint.successRate).toBeCloseTo(0.9);
      expect(endpoint.lastCallAt).toBe(lastCall.toISOString());
    });
  });

  describe('getPromptAnalytics', () => {
    it('returns KPIs and job list for a prompt', async () => {
      mockPrisma.evaluationJob.findMany.mockResolvedValue([
        {
          id: 'job-1',
          grade: 'A',
          status: 'completed',
          modelName: 'gpt-4',
          metrics: ['accuracy', 'f1'],
          completedAt: new Date(),
          createdAt: new Date(),
          results: [
            { metricName: 'accuracy', score: 0.9, grade: 'A' },
            { metricName: 'f1', score: 0.85, grade: 'B' },
          ],
        },
      ]);

      const result = await service.getPromptAnalytics('prompt-1');
      expect(result.promptId).toBe('prompt-1');
      expect(result.kpis.totalJobs).toBe(1);
      expect(result.kpis.completedJobs).toBe(1);
      expect(result.kpis.avgAccuracy).toBeCloseTo(0.9);
      expect(result.kpis.avgF1).toBeCloseTo(0.85);
    });

    it('returns null KPIs when no matching metric results', async () => {
      mockPrisma.evaluationJob.findMany.mockResolvedValue([
        {
          id: 'job-2',
          grade: null,
          status: 'completed',
          modelName: 'gpt-3.5',
          metrics: [],
          completedAt: new Date(),
          createdAt: new Date(),
          results: [],
        },
      ]);

      const result = await service.getPromptAnalytics('prompt-2');
      expect(result.kpis.avgAccuracy).toBeNull();
      expect(result.kpis.avgF1).toBeNull();
    });
  });

  describe('getOptimizationSuggestions', () => {
    beforeEach(() => {
      mockPrisma.prompt.findUnique.mockResolvedValue({
        id: 'prompt-1',
        versions: [{ versionNumber: 1, content: 'Hello {{name}}' }],
      });
      mockPrisma.evaluationJob.findMany.mockResolvedValue([]);
    });

    it('throws NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue(null);
      await expect(service.getOptimizationSuggestions('bad-id', 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('falls back to heuristic suggestions when worker is unavailable', async () => {
      // fetch is not available in test env, so it will throw and use fallback
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.getOptimizationSuggestions('prompt-1', 5);
      expect(result.promptId).toBe('prompt-1');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('returns fallback with poor-grade warning when jobs have D/F grades', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      mockPrisma.evaluationJob.findMany.mockResolvedValue([
        { grade: 'F', results: [{ metricName: 'accuracy', score: 0.2 }] },
        { grade: 'D', results: [{ metricName: 'f1', score: 0.3 }] },
      ]);

      const result = await service.getOptimizationSuggestions('prompt-1', 5);
      expect(result.suggestions.some((s) => s.includes('poor grade'))).toBe(true);
    });
  });

  describe('publishMetrics', () => {
    it('publishes to the correct Redis channel', async () => {
      const summary = {
        totalCalls: 10,
        successCalls: 9,
        errorCalls: 1,
        successRate: 0.9,
        avgLatencyMs: 100,
        totalTokens: 500,
        totalCostUsd: 0.01,
        failoverCalls: 0,
        windowStart: new Date().toISOString(),
      };

      // Access the internal redis instance via the service
      const redisMock = (service as unknown as { redis: { publish: jest.Mock } }).redis;
      await service.publishMetrics('ws-1', summary);
      expect(redisMock.publish).toHaveBeenCalledWith(
        'metrics.workspace.ws-1',
        expect.stringContaining('"workspaceId":"ws-1"'),
      );
    });
  });
});
