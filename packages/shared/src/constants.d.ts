export declare const UserRole: {
  readonly OWNER: 'owner';
  readonly ADMIN: 'admin';
  readonly DEVELOPER: 'developer';
  readonly VIEWER: 'viewer';
  readonly API_USER: 'api_user';
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const ApiKeyScope: {
  readonly ORGANIZATION: 'organization';
  readonly WORKSPACE: 'workspace';
  readonly READONLY: 'readonly';
};
export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];
export declare const API_KEY_PREFIXES: {
  readonly organization: 'sk_org_';
  readonly workspace: 'sk_ws_';
  readonly readonly: 'sk_ro_';
};
export declare const PromptStatus: {
  readonly DRAFT: 'draft';
  readonly LIVE: 'live';
  readonly ARCHIVED: 'archived';
};
export type PromptStatus = (typeof PromptStatus)[keyof typeof PromptStatus];
export declare const VariableType: {
  readonly STRING: 'string';
  readonly NUMBER: 'number';
  readonly BOOLEAN: 'boolean';
  readonly ARRAY: 'array';
  readonly OBJECT: 'object';
};
export type VariableType = (typeof VariableType)[keyof typeof VariableType];
/** Regex that matches {{variable_name}} patterns inside prompt content. */
export declare const VARIABLE_PATTERN: RegExp;
export declare const DatasetStatus: {
  readonly ACTIVE: 'active';
  readonly INACTIVE: 'inactive';
};
export type DatasetStatus = (typeof DatasetStatus)[keyof typeof DatasetStatus];
export declare const DatasetVersionStatus: {
  readonly LATEST: 'latest';
  readonly ARCHIVED: 'archived';
};
export type DatasetVersionStatus = (typeof DatasetVersionStatus)[keyof typeof DatasetVersionStatus];
export declare const ProviderType: {
  readonly OPENAI: 'openai';
  readonly TOGETHERAI: 'togetherai';
  readonly MISTRAL: 'mistral';
  readonly ANTHROPIC: 'anthropic';
  readonly GROQ: 'groq';
  readonly OLLAMA: 'ollama';
  readonly CUSTOM: 'custom';
};
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];
export declare const EvaluationStatus: {
  readonly PENDING: 'pending';
  readonly RUNNING: 'running';
  readonly COMPLETED: 'completed';
  readonly FAILED: 'failed';
};
export type EvaluationStatus = (typeof EvaluationStatus)[keyof typeof EvaluationStatus];
export declare const EvaluationGrade: {
  readonly A_PLUS: 'A+';
  readonly A: 'A';
  readonly B: 'B';
  readonly C: 'C';
  readonly D: 'D';
  readonly F: 'F';
};
export type EvaluationGrade = (typeof EvaluationGrade)[keyof typeof EvaluationGrade];
/** Minimum score (inclusive) required for each grade. */
export declare const GRADE_THRESHOLDS: Record<EvaluationGrade, number>;
export declare const MetricCategory: {
  readonly QUALITY: 'Quality';
  readonly COHERENCE: 'Coherence';
  readonly CONSISTENCY: 'Consistency';
  readonly COST: 'Cost';
  readonly PERFORMANCE: 'Performance';
  readonly RELEVANCE: 'Relevance';
  readonly RELIABILITY: 'Reliability';
  readonly SIMILARITY: 'Similarity';
  readonly SPEED: 'Speed';
  readonly SUSTAINABILITY: 'Sustainability';
  readonly TECHNICAL: 'Technical';
};
export type MetricCategory = (typeof MetricCategory)[keyof typeof MetricCategory];
export declare const DeploymentEnvironment: {
  readonly DEV: 'dev';
  readonly STAGING: 'staging';
  readonly PROD: 'prod';
};
export type DeploymentEnvironment =
  (typeof DeploymentEnvironment)[keyof typeof DeploymentEnvironment];
export declare const DEPLOYMENT_PIPELINE: DeploymentEnvironment[];
export declare const AgentStatus: {
  readonly DRAFT: 'draft';
  readonly LIVE: 'live';
  readonly ARCHIVED: 'archived';
};
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];
export declare const NodeType: {
  readonly START: 'start';
  readonly PROMPT: 'prompt';
  readonly CONDITION: 'condition';
  readonly LOOP: 'loop';
  readonly PARALLEL: 'parallel';
  readonly OUTPUT: 'output';
};
export type NodeType = (typeof NodeType)[keyof typeof NodeType];
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const ApiKeyStatus: {
  readonly ACTIVE: 'active';
  readonly EXPIRED: 'expired';
  readonly DISABLED: 'disabled';
};
export type ApiKeyStatus = (typeof ApiKeyStatus)[keyof typeof ApiKeyStatus];
//# sourceMappingURL=constants.d.ts.map
