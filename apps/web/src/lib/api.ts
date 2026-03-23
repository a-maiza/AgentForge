import axios from 'axios';

const api = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Clerk token on every request (client side only)
api.interceptors.request.use(async (config) => {
  try {
    if (typeof window !== 'undefined') {
      // Access Clerk from the global object set by @clerk/nextjs
      const clerkGlobal = (
        window as typeof window & {
          Clerk?: { session?: { getToken: () => Promise<string | null> } };
        }
      ).Clerk;
      const token = await clerkGlobal?.session?.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // No auth context available
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// Typed API helpers
export const promptsApi = {
  list: (workspaceId: string) => api.get(`/api/workspaces/${workspaceId}/prompts`),
  get: (workspaceId: string, id: string) => api.get(`/api/workspaces/${workspaceId}/prompts/${id}`),
  create: (workspaceId: string, data: { name: string; content: string; description?: string }) =>
    api.post(`/api/workspaces/${workspaceId}/prompts`, { ...data, workspaceId }),
  update: (
    workspaceId: string,
    id: string,
    data: Partial<{ name: string; content: string; description: string }>,
  ) => api.put(`/api/workspaces/${workspaceId}/prompts/${id}`, data),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/api/workspaces/${workspaceId}/prompts/${id}`),
  versions: (workspaceId: string, id: string) =>
    api.get(`/api/workspaces/${workspaceId}/prompts/${id}/versions`),
};

export const workspacesApi = {
  list: () => api.get('/api/workspaces'),
  get: (orgId: string, workspaceId: string) =>
    api.get(`/api/organizations/${orgId}/workspaces/${workspaceId}`),
  create: (orgId: string, data: { name: string; slug: string }) =>
    api.post(`/api/organizations/${orgId}/workspaces`, data),
  delete: (orgId: string, workspaceId: string) =>
    api.delete(`/api/organizations/${orgId}/workspaces/${workspaceId}`),
  activeDeploymentCount: (workspaceId: string) =>
    api.get<{ count: number }>(`/api/workspaces/${workspaceId}/deployments/active-count`),
};

// Organizations
export const organizationsApi = {
  list: () => api.get('/api/organizations'),
  create: (data: { name: string; slug: string }) => api.post('/api/organizations', data),
  delete: (orgId: string) => api.delete(`/api/organizations/${orgId}`),
};

// Datasets
export const datasetsApi = {
  list: (workspaceId: string) => api.get(`/api/workspaces/${workspaceId}/datasets`),
  get: (workspaceId: string, id: string) =>
    api.get(`/api/workspaces/${workspaceId}/datasets/${id}`),
  create: (workspaceId: string, data: { name: string; description?: string }) =>
    api.post(`/api/workspaces/${workspaceId}/datasets`, data),
  update: (workspaceId: string, id: string, data: { name?: string; description?: string }) =>
    api.put(`/api/workspaces/${workspaceId}/datasets/${id}`, data),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/api/workspaces/${workspaceId}/datasets/${id}`),
  upload: (_workspaceId: string, id: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/datasets/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    });
  },
  preview: (id: string, versionId: string) =>
    api.get(`/api/datasets/${id}/versions/${versionId}/preview`),
  compare: (id: string, v1: string, v2: string) =>
    api.post(`/api/datasets/${id}/versions/compare`, { versionId1: v1, versionId2: v2 }),
  versions: (workspaceId: string, id: string) =>
    api.get(`/api/workspaces/${workspaceId}/datasets/${id}/versions`),
};

// AI Providers
export const aiProvidersApi = {
  list: (workspaceId: string) => api.get(`/api/workspaces/${workspaceId}/ai-providers`),
  get: (id: string) => api.get(`/api/ai-providers/${id}`),
  create: (workspaceId: string, data: Record<string, unknown>) =>
    api.post(`/api/workspaces/${workspaceId}/ai-providers`, data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/ai-providers/${id}`, data),
  delete: (id: string) => api.delete(`/api/ai-providers/${id}`),
};

// Prompt AI Configs
export const promptAiConfigsApi = {
  get: (promptId: string) => api.get(`/api/prompts/${promptId}/ai-config`),
  upsert: (promptId: string, data: Record<string, unknown>) =>
    api.put(`/api/prompts/${promptId}/ai-config`, data),
};

// Prompt Dataset Configs
export const promptDatasetConfigsApi = {
  get: (promptId: string) => api.get(`/api/prompts/${promptId}/dataset-config`),
  upsert: (promptId: string, data: Record<string, unknown>) =>
    api.put(`/api/prompts/${promptId}/dataset-config`, data),
};

// Evaluations
export const evaluationsApi = {
  list: (params?: { status?: string; promptId?: string }) =>
    api.get('/api/evaluations', { params }),
  get: (id: string) => api.get(`/api/evaluations/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/evaluations', data),
  cancel: (id: string) => api.delete(`/api/evaluations/${id}`),
};

// Metrics
export const metricsApi = {
  list: () => api.get('/api/metrics'),
  suggest: (promptContent: string, topN = 5) =>
    api.post('/api/metrics/suggest', { promptContent, topN }),
};

// Deployments
export const deploymentsApi = {
  list: (promptId: string) => api.get(`/api/prompts/${promptId}/deployments`),
  history: (promptId: string) => api.get(`/api/prompts/${promptId}/deployments/history`),
  deploy: (
    promptId: string,
    data: { promptVersionId: string; environment: string; notes?: string },
  ) => api.post(`/api/prompts/${promptId}/deploy`, data),
  promote: (promptId: string, data: { targetEnvironment: string; notes?: string }) =>
    api.post(`/api/prompts/${promptId}/promote`, data),
  rollback: (promptId: string, environment: string) =>
    api.post(`/api/prompts/${promptId}/rollback/${environment}`),
  goLive: (promptId: string, environment: string) =>
    api.post(`/api/prompts/${promptId}/go-live/${environment}`),
};

// Failover configs
export const failoverConfigsApi = {
  get: (promptId: string) => api.get(`/api/prompts/${promptId}/failover-config`),
  upsert: (promptId: string, data: Record<string, unknown>) =>
    api.put(`/api/prompts/${promptId}/failover-config`, data),
  remove: (promptId: string) => api.delete(`/api/prompts/${promptId}/failover-config`),
};

// Monitoring
export const monitoringApi = {
  summary: (workspaceId: string, params?: { window?: string; environment?: string }) =>
    api.get(`/api/monitoring/workspaces/${workspaceId}/summary`, { params }),
  timeseries: (
    workspaceId: string,
    params?: { from?: string; to?: string; bucket?: string; environment?: string },
  ) => api.get(`/api/monitoring/workspaces/${workspaceId}/timeseries`, { params }),
  apiCalls: (workspaceId: string, params?: { environment?: string }) =>
    api.get(`/api/monitoring/workspaces/${workspaceId}/api-calls`, { params }),
  promptAnalytics: (promptId: string) => api.get(`/api/monitoring/prompts/${promptId}/analytics`),
  suggestions: (promptId: string, lastN?: number) =>
    api.get(`/api/monitoring/prompts/${promptId}/suggestions`, { params: { lastN } }),
};

// API Keys
export const apiKeysApi = {
  list: (workspaceId: string, status?: string) =>
    api.get(`/api/workspaces/${workspaceId}/api-keys`, { params: status ? { status } : undefined }),
  get: (workspaceId: string, id: string) =>
    api.get(`/api/workspaces/${workspaceId}/api-keys/${id}`),
  create: (workspaceId: string, data: Record<string, unknown>) =>
    api.post(`/api/workspaces/${workspaceId}/api-keys`, data),
  disable: (workspaceId: string, id: string) =>
    api.patch(`/api/workspaces/${workspaceId}/api-keys/${id}/disable`),
  remove: (workspaceId: string, id: string) =>
    api.delete(`/api/workspaces/${workspaceId}/api-keys/${id}`),
};
