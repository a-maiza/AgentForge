/** Input / output cost in USD per 1 M tokens */
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  // Mistral
  'mistral-large-latest': { input: 8, output: 24 },
  'mistral-small-latest': { input: 1, output: 3 },
  // Together / open models
  'meta-llama/Llama-3-70b-chat-hf': { input: 0.9, output: 0.9 },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.6, output: 0.6 },
  // Groq (very cheap)
  'llama3-70b-8192': { input: 0.59, output: 0.79 },
  'mixtral-8x7b-32768': { input: 0.27, output: 0.27 },
};

const DEFAULT = { input: 1, output: 3 };

/** Returns estimated USD cost for a single LLM call */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}
