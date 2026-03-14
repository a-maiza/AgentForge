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
    api.post(`/api/workspaces/${workspaceId}/prompts`, data),
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
};
