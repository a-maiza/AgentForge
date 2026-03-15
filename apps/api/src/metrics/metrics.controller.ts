import { Controller, Get } from '@nestjs/common';

interface Metric {
  id: string;
  name: string;
  category: string;
  description: string;
}

const METRICS_CATALOGUE: Metric[] = [
  { id: 'accuracy', name: 'Accuracy', category: 'Quality', description: 'Overall correct response rate' },
  { id: 'exact_match', name: 'Exact Match (EM)', category: 'Quality', description: '% of exactly correct responses' },
  { id: 'f1_score', name: 'F1-Score', category: 'Quality', description: 'Balance between precision and recall' },
  { id: 'precision', name: 'Precision', category: 'Quality', description: 'Correct positive predictions ratio' },
  { id: 'recall', name: 'Recall', category: 'Quality', description: 'Ability to find all positive instances' },
  { id: 'fluency_score', name: 'Fluency Score', category: 'Coherence', description: 'Grammar and readability' },
  { id: 'grammar_score', name: 'Grammar Score', category: 'Coherence', description: 'Syntactic correctness' },
  { id: 'perplexity', name: 'Perplexity', category: 'Coherence', description: 'Model confidence measure' },
  { id: 'consistency_score', name: 'Consistency Score', category: 'Consistency', description: 'Output stability across runs' },
  { id: 'response_variance', name: 'Response Variance', category: 'Consistency', description: 'Standard deviation of outputs' },
  { id: 'cost_estimate', name: 'Cost Estimate', category: 'Cost', description: 'Estimated cost per evaluation' },
  { id: 'cost_per_request', name: 'Cost per Request', category: 'Performance', description: 'Average cost per API call' },
  { id: 'eval_duration', name: 'Eval Duration', category: 'Performance', description: 'Total evaluation time' },
  { id: 'input_tokens', name: 'Input Tokens', category: 'Performance', description: 'Average input token count' },
  { id: 'output_tokens', name: 'Output Tokens', category: 'Performance', description: 'Average output token count' },
  { id: 'overall_efficiency', name: 'Overall Efficiency Score', category: 'Composite', description: 'Quality/cost ratio' },
  { id: 'latency_percentiles', name: 'Latency (p50/p90/p99)', category: 'Speed', description: 'Response time percentiles' },
  { id: 'processing_speed', name: 'Processing Speed', category: 'Speed', description: 'Tokens per second' },
  { id: 'carbon_footprint', name: 'Carbon Footprint', category: 'Sustainability', description: 'gCO2 per 1000 tokens' },
  { id: 'power_consumption', name: 'Power Consumption', category: 'Sustainability', description: 'mWh per 1000 tokens' },
];

@Controller('api/metrics')
export class MetricsController {
  @Get()
  findAll() {
    return METRICS_CATALOGUE;
  }
}
