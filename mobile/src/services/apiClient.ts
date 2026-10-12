import { getApiBaseUrl, API_TIMEOUT_MS } from '../config/env';
import { getAuthToken } from './storage';
import { ApiErrorDetails } from '../types/auth';

/**
 * Custom structured error for BeltFlow API requests
 */
export class ApiError extends Error implements ApiErrorDetails {
  public readonly status: number;
  public readonly details?: unknown;
  public readonly isNetworkError: boolean;
  public readonly isTimeout: boolean;
  public readonly isUnauthorized: boolean;

  constructor(params: {
    message: string;
    status: number;
    details?: unknown;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    isUnauthorized?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.details = params.details;
    this.isNetworkError = Boolean(params.isNetworkError);
    this.isTimeout = Boolean(params.isTimeout);
    this.isUnauthorized = Boolean(params.isUnauthorized || params.status === 401);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  requiresAuth?: boolean;
}

type UnauthorizedHandler = () => void | Promise<void>;
const unauthorizedListeners: Set<UnauthorizedHandler> = new Set();

export function onUnauthorizedResponse(handler: UnauthorizedHandler): () => void {
  unauthorizedListeners.add(handler);
  return () => {
    unauthorizedListeners.delete(handler);
  };
}

async function notifyUnauthorized(): Promise<void> {
  const promises = Array.from(unauthorizedListeners).map(listener => {
    try {
      return listener();
    } catch {
      return Promise.resolve();
    }
  });
  await Promise.allSettled(promises);
}

/**
 * Core HTTP Request Dispatcher
 */
async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    headers: customHeaders = {},
    body,
    timeoutMs = API_TIMEOUT_MS,
    requiresAuth = true,
    ...rest
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Inject Bearer token if required & available
  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let serializedBody: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    serializedBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: serializedBody,
      signal: controller.signal,
      ...rest,
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      await notifyUnauthorized();
    }

    // Parse JSON or text response
    let responseData: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json().catch(() => null);
    } else {
      responseData = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errorMessage =
        responseData?.error ||
        responseData?.message ||
        `Request failed with HTTP status ${response.status}`;

      throw new ApiError({
        message: errorMessage,
        status: response.status,
        details: responseData,
        isUnauthorized: response.status === 401,
      });
    }

    return responseData as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    // AbortError / Timeout
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      throw new ApiError({
        message: `Request timed out after ${timeoutMs}ms. Please check your connection.`,
        status: 408,
        isTimeout: true,
      });
    }

    // Network disconnection / offline / DNS failure
    const isNetwork =
      error?.message?.toLowerCase().includes('network') ||
      error?.message?.toLowerCase().includes('failed to fetch') ||
      error instanceof TypeError;

    throw new ApiError({
      message: isNetwork
        ? 'Network connection failed. Please verify internet access and backend connectivity.'
        : error?.message || 'An unexpected request error occurred.',
      status: 0,
      isNetworkError: true,
      details: error,
    });
  }
}

export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
