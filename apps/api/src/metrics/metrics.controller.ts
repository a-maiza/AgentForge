import { Controller, Get, Post, Body, HttpException, HttpStatus } from '@nestjs/common';

interface Metric {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface MetricSuggestion {
  metric: string;
  match_pct: number;
  reason: string;
}

interface SuggestBody {
  promptContent: string;
  topN?: number;
}

// IDs must match the metric names recognised by apps/worker/app/metrics/scorers.py
const METRICS_CATALOGUE: Metric[] = [
  {
    id: 'exact_match',
    name: 'Exact Match (EM)',
    category: 'Quality',
    description: '% of exactly correct responses (requires reference column in dataset)',
  },
  {
    id: 'f1',
    name: 'F1-Score',
    category: 'Quality',
    description: 'Token-level F1 between prediction and reference',
  },
  {
    id: 'bleu',
    name: 'BLEU',
    category: 'Quality',
    description: 'N-gram overlap score (requires reference column)',
  },
  {
    id: 'rouge',
    name: 'ROUGE',
    category: 'Quality',
    description: 'Recall-oriented overlap score (requires reference column)',
  },
  {
    id: 'bertscore',
    name: 'BERTScore',
    category: 'Quality',
    description: 'Semantic similarity using sentence embeddings',
  },
  {
    id: 'accuracy',
    name: 'Accuracy',
    category: 'Quality',
    description: 'Overall correct response rate',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    category: 'Coherence',
    description: 'Model confidence measure (requires log-prob support)',
  },
  {
    id: 'consistency_score',
    name: 'Consistency Score',
    category: 'Consistency',
    description: 'Output stability across repeated runs (slower — adds extra LLM calls)',
  },
  {
    id: 'latency',
    name: 'Latency (p50/p90/p99)',
    category: 'Speed',
    description: 'Response time percentiles in milliseconds',
  },
  {
    id: 'throughput',
    name: 'Processing Speed',
    category: 'Speed',
    description: 'Tokens per second across all rows',
  },
];

const WORKER_URL = process.env['WORKER_URL'] ?? 'http://worker:8000';

@Controller('api/metrics')
export class MetricsController {
  @Get()
  findAll(): Metric[] {
    return METRICS_CATALOGUE;
  }

  @Post('suggest')
  async suggest(@Body() body: SuggestBody): Promise<{ suggestions: MetricSuggestion[] }> {
    try {
      const response = await fetch(`${WORKER_URL}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_content: body.promptContent,
          top_n: body.topN ?? 5,
        }),
      });

      if (!response.ok) {
        throw new HttpException('Worker suggest endpoint failed', HttpStatus.BAD_GATEWAY);
      }

      return response.json() as Promise<{ suggestions: MetricSuggestion[] }>;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Worker unreachable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
