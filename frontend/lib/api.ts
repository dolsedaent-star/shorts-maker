import { clearToken, getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type ReqOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
};

export async function api<T = unknown>(path: string, opts: ReqOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts.headers ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.raw && opts.body instanceof FormData) {
      body = opts.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers,
    body,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, null, 'Unauthorized');
  }

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string'
        ? parsed.message
        : null) ||
      (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
        ? parsed.error
        : null) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, parsed, msg);
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type AssetKind = 'video' | 'audio' | 'image';

// 업로드 전용 헬퍼
export async function uploadFile(
  sectionId: string,
  kind: AssetKind,
  file: File
): Promise<{ ok: boolean; path: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return api(`/api/sections/${sectionId}/upload?kind=${kind}`, {
    method: 'POST',
    body: fd,
    raw: true,
  });
}
