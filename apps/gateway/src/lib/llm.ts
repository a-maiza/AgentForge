import type { LlmCallConfig, LlmCallResult } from '../types.js';

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com',
  together: 'https://api.together.xyz',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
  ollama: 'http://localhost:11434',
};

interface OpenAiResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface AnthropicResponse {
  content: Array<{ text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

async function callOpenAiCompat(config: LlmCallConfig): Promise<LlmCallResult> {
  const baseUrl = config.baseUrl ?? PROVIDER_BASE_URLS[config.providerType] ?? '';
  const url = `${baseUrl}/v1/chat/completions`;

  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [{ role: 'user', content: config.prompt }],
      ...(config.temperature != null && { temperature: config.temperature }),
      ...(config.topP != null && { top_p: config.topP }),
      ...(config.maxTokens != null && { max_tokens: config.maxTokens }),
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as OpenAiResponse;
  const latencyMs = Date.now() - t0;

  return {
    output: json.choices[0]?.message.content ?? '',
    inputTokens: json.usage.prompt_tokens,
    outputTokens: json.usage.completion_tokens,
    latencyMs,
  };
}

async function callAnthropic(config: LlmCallConfig): Promise<LlmCallResult> {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [{ role: 'user', content: config.prompt }],
      max_tokens: config.maxTokens ?? 1024,
      ...(config.temperature != null && { temperature: config.temperature }),
      ...(config.topP != null && { top_p: config.topP }),
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as AnthropicResponse;
  const latencyMs = Date.now() - t0;

  return {
    output: json.content[0]?.text ?? '',
    inputTokens: json.usage.input_tokens,
    outputTokens: json.usage.output_tokens,
    latencyMs,
  };
}

/** Dispatch an LLM call to the correct provider. */
export async function callLlm(config: LlmCallConfig): Promise<LlmCallResult> {
  if (config.providerType === 'anthropic') return callAnthropic(config);
  return callOpenAiCompat(config);
}
