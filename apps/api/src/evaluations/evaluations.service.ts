import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';
import type { EvaluationJob } from '@prisma/client';
import type { CreateEvaluationDto } from './dto/create-evaluation.dto';

const QUEUE_NAME = 'evaluations';

@Injectable()
export class EvaluationsService {
  private readonly queue: Queue;

  constructor(private readonly prisma: PrismaService) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: {
        host: process.env['REDIS_URL']?.replace('redis://', '').split(':')[0] ?? 'localhost',
        port: Number.parseInt(
          process.env['REDIS_URL']?.replace('redis://', '').split(':')[1] ?? '6379',
          10,
        ),
      },
    });
  }

  async create(dto: CreateEvaluationDto, userId: string): Promise<EvaluationJob> {
    // Validate prompt exists
    const prompt = await this.prisma.prompt.findUnique({ where: { id: dto.promptId } });
    if (!prompt) throw new NotFoundException('Prompt not found');

    // Resolve dataset from prompt config if not provided
    let datasetId = dto.datasetId;
    let datasetVersionId = dto.datasetVersionId;
    if (!datasetId) {
      const datasetConfig = await this.prisma.promptDatasetConfig.findFirst({
        where: { promptId: dto.promptId },
      });
      if (!datasetConfig)
        throw new BadRequestException(
          'No dataset connected to this prompt. Go to the Dataset tab and connect a dataset first.',
        );
      datasetId = datasetConfig.datasetId;
      datasetVersionId = datasetConfig.datasetVersionId;
    }

    // Resolve AI provider from prompt config if not provided
    let providerId = dto.providerId;
    let modelName = dto.modelName;
    let modelConfig: Record<string, unknown> = dto.modelConfig ?? {};
    if (!providerId) {
      const aiConfig = await this.prisma.promptAiConfig.findFirst({
        where: { promptId: dto.promptId },
      });
      if (!aiConfig)
        throw new BadRequestException(
          'No AI provider configured for this prompt. Go to the AI Provider tab and configure a provider first.',
        );
      providerId = aiConfig.providerId;
      modelName = aiConfig.modelName;
      modelConfig = {
        temperature: aiConfig.temperature,
        topP: aiConfig.topP,
        maxTokens: aiConfig.maxTokens,
      };
    }

    const job = await this.prisma.evaluationJob.create({
      data: {
        promptId: dto.promptId,
        promptVersionId: dto.promptVersionId,
        datasetId: datasetId!,
        datasetVersionId: datasetVersionId!,
        providerId: providerId!,
        modelName: modelName ?? '',
        modelConfig: modelConfig as object,
        metrics: dto.metrics,
        status: 'pending',
        progress: 0,
        createdBy: userId,
      },
    });

    // Enqueue to BullMQ
    await this.queue.add('evaluate', { jobId: job.id }, { jobId: job.id });

    return job;
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const job = await this.prisma.evaluationJob.findUnique({
      where: { id },
      include: {
        results: true,
        prompt: { select: { name: true } },
        provider: { select: { name: true } },
        dataset: { select: { name: true } },
      },
    });
    if (!job) throw new NotFoundException('Evaluation job not found');

    // Compute duration in seconds
    let duration: number | undefined;
    if (job.startedAt && job.completedAt) {
      duration = Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }

    // Extract display metrics from stored EvaluationResult rows
    type ResultRow = { metricName: string; score: number; details: unknown };
    const results = job.results as ResultRow[];
    const getScore = (name: string) => results.find((r) => r.metricName === name)?.score;
    const getDetails = (name: string) =>
      results.find((r) => r.metricName === name)?.details as Record<string, number> | undefined;

    const accuracyScore = getScore('accuracy') ?? getScore('exact_match');
    const consistencyScore = getScore('consistency_score');
    const latencyDetails = getDetails('latency');
    const throughputDetails = getDetails('throughput');

    return {
      ...job,
      promptName: job.prompt?.name,
      model: job.modelName,
      providerName: job.provider?.name,
      datasetName: job.dataset?.name,
      duration,
      accuracy: accuracyScore !== undefined ? Math.round(accuracyScore * 100) : undefined,
      processingSpeed:
        throughputDetails?.tokens_per_second !== undefined
          ? Math.round(throughputDetails.tokens_per_second)
          : undefined,
      latencyP50:
        latencyDetails?.p50 !== undefined ? Math.round(latencyDetails.p50 * 1000) : undefined,
      consistency:
        consistencyScore !== undefined ? Math.round(consistencyScore * 100) : undefined,
    };
  }

  findAll(filters?: { status?: string; promptId?: string }): Promise<EvaluationJob[]> {
    return this.prisma.evaluationJob.findMany({
      where: {
        ...(filters?.status && {
          status: filters.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
        }),
        ...(filters?.promptId && { promptId: filters.promptId }),
      },
      orderBy: { createdAt: 'desc' },
      include: { prompt: { select: { name: true } } },
    });
  }

  async cancel(id: string): Promise<EvaluationJob> {
    const job = await this.prisma.evaluationJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Evaluation job not found');
    const bullJob = await this.queue.getJob(id);
    if (bullJob) await bullJob.remove();
    return this.prisma.evaluationJob.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async remove(id: string): Promise<void> {
    const job = await this.prisma.evaluationJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Evaluation job not found');
    // Remove from queue if still pending/running
    const bullJob = await this.queue.getJob(id);
    if (bullJob) await bullJob.remove();
    await this.prisma.evaluationJob.delete({ where: { id } });
  }
}
