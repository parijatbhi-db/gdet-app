const BASE = '/api';

async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  const url = params ? `${BASE}${path}?${new URLSearchParams(params)}` : `${BASE}${path}`;
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

function get<T>(path: string, params?: Record<string, string>) { return request<T>('GET', path, undefined, params); }
function post<T>(path: string, body?: unknown) { return request<T>('POST', path, body); }
function put<T>(path: string, body: unknown) { return request<T>('PUT', path, body); }
function del<T>(path: string) { return request<T>('DELETE', path); }

export const api = {
  dashboard: { metrics: () => get<any>('/extracts/dashboard/metrics') },
  extracts: {
    list: (params?: Record<string, string>) => get<any>('/extracts', params),
    get: (id: string) => get<any>(`/extracts/${id}`),
    create: (data: any) => post<any>('/extracts', data),
    update: (id: string, data: any) => put<any>(`/extracts/${id}`, data),
    delete: (id: string) => del<any>(`/extracts/${id}`),
    sourceColumns: (table: string) => get<any>(`/extracts/source-columns/${encodeURIComponent(table)}`),
    preview: (id: string, params?: any) => post<any>(`/extracts/${id}/preview`, params || {}),
    run: (id: string, params?: any) => post<any>(`/extracts/${id}/run`, params || {}),
  },
  runs: {
    list: (params?: Record<string, string>) => get<any>('/runs', params),
    get: (id: string) => get<any>(`/runs/${id}`),
    downloadUrl: (id: string) => `${BASE}/runs/${id}/download`,
  },
  schedules: {
    list: (params?: Record<string, string>) => get<any>('/schedules', params),
    create: (data: any) => post<any>('/schedules', data),
    update: (id: string, data: any) => put<any>(`/schedules/${id}`, data),
    delete: (id: string) => del<any>(`/schedules/${id}`),
  },
  audit: { list: (params?: Record<string, string>) => get<any>('/audit', params) },
};
