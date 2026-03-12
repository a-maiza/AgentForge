// ─── User & Access ───────────────────────────────────────────────────────────

export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
  API_USER: 'api_user',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ApiKeyScope = {
  ORGANIZATION: 'organization',
  WORKSPACE: 'workspace',
  READONLY: 'readonly',
} as const;
export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];

export const API_KEY_PREFIXES = {
  organization: 'sk_org_',
  workspace: 'sk_ws_',
  readonly: 'sk_ro_',
} as const satisfies Record<ApiKeyScope, string>;

// ─── Prompts ─────────────────────────────────────────────────────────────────

export const PromptStatus = {
  DRAFT: 'draft',
  LIVE: 'live',
  ARCHIVED: 'archived',
} as const;
export type PromptStatus = (typeof PromptStatus)[keyof typeof PromptStatus];

export const VariableType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
} as const;
export type VariableType = (typeof VariableType)[keyof typeof VariableType];

/** Regex that matches {{variable_name}} patterns inside prompt content. */
export const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

// ─── Datasets ────────────────────────────────────────────────────────────────

export const DatasetStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;
export type DatasetStatus = (typeof DatasetStatus)[keyof typeof DatasetStatus];

export const DatasetVersionStatus = {
  LATEST: 'latest',
  ARCHIVED: 'archived',
} as const;
export type DatasetVersionStatus = (typeof DatasetVersionStatus)[keyof typeof DatasetVersionStatus];

// ─── AI Providers ─────────────────────────────────────────────────────────────

export const ProviderType = {
  OPENAI: 'openai',
  TOGETHERAI: 'togetherai',
  MISTRAL: 'mistral',
  ANTHROPIC: 'anthropic',
  GROQ: 'groq',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

// ─── Evaluations ─────────────────────────────────────────────────────────────

export const EvaluationStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type EvaluationStatus = (typeof EvaluationStatus)[keyof typeof EvaluationStatus];

export const EvaluationGrade = {
  A_PLUS: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
} as const;
export type EvaluationGrade = (typeof EvaluationGrade)[keyof typeof EvaluationGrade];

/** Minimum score (inclusive) required for each grade. */
export const GRADE_THRESHOLDS: Record<EvaluationGrade, number> = {
  'A+': 95,
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0,
};

export const MetricCategory = {
  QUALITY: 'Quality',
  COHERENCE: 'Coherence',
  CONSISTENCY: 'Consistency',
  COST: 'Cost',
  PERFORMANCE: 'Performance',
  RELEVANCE: 'Relevance',
  RELIABILITY: 'Reliability',
  SIMILARITY: 'Similarity',
  SPEED: 'Speed',
  SUSTAINABILITY: 'Sustainability',
  TECHNICAL: 'Technical',
} as const;
export type MetricCategory = (typeof MetricCategory)[keyof typeof MetricCategory];

// ─── Deployments ─────────────────────────────────────────────────────────────

export const DeploymentEnvironment = {
  DEV: 'dev',
  STAGING: 'staging',
  PROD: 'prod',
} as const;
export type DeploymentEnvironment =
  (typeof DeploymentEnvironment)[keyof typeof DeploymentEnvironment];

export const DEPLOYMENT_PIPELINE: DeploymentEnvironment[] = ['dev', 'staging', 'prod'];

// ─── Agents ──────────────────────────────────────────────────────────────────

export const AgentStatus = {
  DRAFT: 'draft',
  LIVE: 'live',
  ARCHIVED: 'archived',
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const NodeType = {
  START: 'start',
  PROMPT: 'prompt',
  CONDITION: 'condition',
  LOOP: 'loop',
  PARALLEL: 'parallel',
  OUTPUT: 'output',
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

// ─── Pagination ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─── API Key status ───────────────────────────────────────────────────────────

export const ApiKeyStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
} as const;
export type ApiKeyStatus = (typeof ApiKeyStatus)[keyof typeof ApiKeyStatus];
