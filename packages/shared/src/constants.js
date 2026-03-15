'use strict';
// ─── User & Access ───────────────────────────────────────────────────────────
Object.defineProperty(exports, '__esModule', { value: true });
exports.ApiKeyStatus =
  exports.MAX_PAGE_SIZE =
  exports.DEFAULT_PAGE_SIZE =
  exports.NodeType =
  exports.AgentStatus =
  exports.DEPLOYMENT_PIPELINE =
  exports.DeploymentEnvironment =
  exports.MetricCategory =
  exports.GRADE_THRESHOLDS =
  exports.EvaluationGrade =
  exports.EvaluationStatus =
  exports.ProviderType =
  exports.DatasetVersionStatus =
  exports.DatasetStatus =
  exports.VARIABLE_PATTERN =
  exports.VariableType =
  exports.PromptStatus =
  exports.API_KEY_PREFIXES =
  exports.ApiKeyScope =
  exports.UserRole =
    void 0;
exports.UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
  API_USER: 'api_user',
};
exports.ApiKeyScope = {
  ORGANIZATION: 'organization',
  WORKSPACE: 'workspace',
  READONLY: 'readonly',
};
exports.API_KEY_PREFIXES = {
  organization: 'sk_org_',
  workspace: 'sk_ws_',
  readonly: 'sk_ro_',
};
// ─── Prompts ─────────────────────────────────────────────────────────────────
exports.PromptStatus = {
  DRAFT: 'draft',
  LIVE: 'live',
  ARCHIVED: 'archived',
};
exports.VariableType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
};
/** Regex that matches {{variable_name}} patterns inside prompt content. */
exports.VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
// ─── Datasets ────────────────────────────────────────────────────────────────
exports.DatasetStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};
exports.DatasetVersionStatus = {
  LATEST: 'latest',
  ARCHIVED: 'archived',
};
// ─── AI Providers ─────────────────────────────────────────────────────────────
exports.ProviderType = {
  OPENAI: 'openai',
  TOGETHERAI: 'togetherai',
  MISTRAL: 'mistral',
  ANTHROPIC: 'anthropic',
  GROQ: 'groq',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
};
// ─── Evaluations ─────────────────────────────────────────────────────────────
exports.EvaluationStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};
exports.EvaluationGrade = {
  A_PLUS: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
};
/** Minimum score (inclusive) required for each grade. */
exports.GRADE_THRESHOLDS = {
  'A+': 95,
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0,
};
exports.MetricCategory = {
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
};
// ─── Deployments ─────────────────────────────────────────────────────────────
exports.DeploymentEnvironment = {
  DEV: 'dev',
  STAGING: 'staging',
  PROD: 'prod',
};
exports.DEPLOYMENT_PIPELINE = ['dev', 'staging', 'prod'];
// ─── Agents ──────────────────────────────────────────────────────────────────
exports.AgentStatus = {
  DRAFT: 'draft',
  LIVE: 'live',
  ARCHIVED: 'archived',
};
exports.NodeType = {
  START: 'start',
  PROMPT: 'prompt',
  CONDITION: 'condition',
  LOOP: 'loop',
  PARALLEL: 'parallel',
  OUTPUT: 'output',
};
// ─── Pagination ───────────────────────────────────────────────────────────────
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
// ─── API Key status ───────────────────────────────────────────────────────────
exports.ApiKeyStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
};
//# sourceMappingURL=constants.js.map
