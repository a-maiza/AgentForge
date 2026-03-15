import type {
  AgentStatus,
  ApiKeyScope,
  ApiKeyStatus,
  DatasetStatus,
  DatasetVersionStatus,
  DeploymentEnvironment,
  EvaluationGrade,
  EvaluationStatus,
  MetricCategory,
  NodeType,
  PromptStatus,
  ProviderType,
  UserRole,
  VariableType,
} from './constants.js';
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}
export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
  user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>;
}
export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  createdAt: string;
}
export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>;
}
export interface PromptVariable {
  id: string;
  promptId: string;
  name: string;
  type: VariableType;
  description: string | null;
  defaultValue: string | null;
}
export interface PromptVersion {
  id: string;
  promptId: string;
  versionNumber: number;
  content: string;
  characterCount: number;
  createdBy: string;
  createdAt: string;
}
export interface Prompt {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: PromptStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentVersion?: PromptVersion;
  variables?: PromptVariable[];
}
export interface PromptSummary extends Pick<
  Prompt,
  'id' | 'name' | 'description' | 'status' | 'createdAt' | 'updatedAt'
> {
  currentVersionNumber: number;
  evaluationCount: number;
  latestGrade: EvaluationGrade | null;
}
export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  storagePath: string;
  rowCount: number;
  columnCount: number;
  fileSizeBytes: number;
  columns: Record<string, string>;
  status: DatasetVersionStatus;
  createdAt: string;
}
export interface Dataset {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: DatasetStatus;
  createdBy: string;
  createdAt: string;
  latestVersion?: DatasetVersion;
  versionCount?: number;
}
export interface PromptDatasetConfig {
  id: string;
  promptId: string;
  datasetId: string;
  datasetVersionId: string;
  variableMapping: Record<string, string>;
  isActive: boolean;
  createdAt: string;
}
export interface AiProvider {
  id: string;
  workspaceId: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string | null;
  isActive: boolean;
  createdAt: string;
}
export interface PromptAiConfig {
  id: string;
  promptId: string;
  providerId: string;
  modelName: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  repetitionPenalty: number;
  frequencyPenalty: number | null;
  stopSequences: string[];
  createdAt: string;
}
export interface EvaluationResult {
  id: string;
  jobId: string;
  metricName: string;
  score: number;
  grade: EvaluationGrade;
  threshold: number;
  details: Record<string, unknown>;
  createdAt: string;
}
export interface EvaluationJob {
  id: string;
  promptId: string;
  promptVersionId: string;
  datasetId: string;
  datasetVersionId: string;
  providerId: string;
  modelName: string;
  modelConfig: Record<string, unknown>;
  metrics: string[];
  status: EvaluationStatus;
  progress: number;
  grade: EvaluationGrade | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdBy: string;
  createdAt: string;
  results?: EvaluationResult[];
}
export interface MetricDefinition {
  name: string;
  category: MetricCategory;
  description: string;
  higherIsBetter: boolean;
}
export interface Deployment {
  id: string;
  promptId: string;
  environment: DeploymentEnvironment;
  versionString: string;
  promptVersionId: string;
  providerId: string;
  secondaryProviderId: string | null;
  isLive: boolean;
  endpointHash: string | null;
  deployedBy: string;
  deployedAt: string;
}
export interface FailoverConfig {
  id: string;
  promptId: string;
  isEnabled: boolean;
  timeoutMs: number;
  errorThreshold: number;
  maxLatencyMs: number;
  autoRecovery: boolean;
  recoveryCheckIntervalMs: number;
  createdAt: string;
}
export interface ApiKey {
  id: string;
  workspaceId: string | null;
  orgId: string | null;
  name: string;
  keyPrefix: string;
  scope: ApiKeyScope;
  rateLimitPerMin: number;
  rateLimitPerDay: number;
  usageCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  status: ApiKeyStatus;
  createdBy: string;
  createdAt: string;
}
export interface ApiCallLog {
  id: string;
  endpointHash: string;
  promptId: string;
  apiKeyId: string;
  environment: DeploymentEnvironment;
  statusCode: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errorMessage: string | null;
  createdAt: string;
}
export interface LiveEndpointResponse {
  output: string;
  latencyMs: number;
  tokens: {
    input: number;
    output: number;
  };
}
export interface WorkflowNodeData {
  label: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
}
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: {
    x: number;
    y: number;
  };
  data: WorkflowNodeData;
}
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}
export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  currentVersion: string;
  workflowDefinition: WorkflowDefinition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface MonitoringKpis {
  totalCalls: number;
  successRate: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}
export interface MonitoringTimeseriesPoint {
  timestamp: string;
  calls: number;
  successRate: number;
  avgLatencyMs: number;
  tokens: number;
}
export interface MetricsUpdateEvent {
  type: 'metrics_update';
  data: {
    callsLastMinute: number;
    successRate: number;
    avgLatencyMs: number;
    tokensIn: number;
    tokensOut: number;
  };
}
//# sourceMappingURL=types.d.ts.map
