/** Cached prompt configuration looked up by endpoint_hash */
export interface PromptConfig {
  deploymentId: string;
  workspaceId: string;
  promptContent: string;
  modelName: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  providerType: string;
  apiKeyEncrypted: string;
  baseUrl: string | null;
  failover: FailoverDetail | null;
}

export interface FailoverDetail {
  timeoutMs: number;
  errorThreshold: number;
  latencyThresholdMs: number;
  secondaryProviderType: string;
  secondaryApiKeyEncrypted: string;
  secondaryBaseUrl: string | null;
  secondaryModelName: string;
}

/** Slim record cached in Redis after API key validation */
export interface CachedApiKey {
  id: string;
  workspaceId: string;
  status: string;
}

export interface LlmCallConfig {
  prompt: string;
  providerType: string;
  apiKey: string;
  baseUrl: string | null;
  modelName: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeoutMs: number;
}

export interface LlmCallResult {
  output: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}
