import { Injectable, NotFoundException } from '@nestjs/common';
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

    const job = await this.prisma.evaluationJob.create({
      data: {
        promptId: dto.promptId,
        promptVersionId: dto.promptVersionId,
        datasetId: dto.datasetId,
        datasetVersionId: dto.datasetVersionId,
        providerId: dto.providerId,
        modelName: dto.modelName,
        modelConfig: (dto.modelConfig ?? {}) as object,
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

  async findOne(id: string): Promise<EvaluationJob & { results: unknown[] }> {
    const job = await this.prisma.evaluationJob.findUnique({
      where: { id },
      include: { results: true, prompt: { select: { name: true } } },
    });
    if (!job) throw new NotFoundException('Evaluation job not found');
    return job;
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
}
