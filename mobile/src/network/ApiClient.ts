import { ApiConfig } from '../config/ApiConfig';
import type { ISecureTokenStore } from '../repositories/contracts/ISecureTokenStore';

const MAX_OUTBOUND_JSON_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ApiClientOptions {
  readonly config: ApiConfig;
  readonly tokenStore: ISecureTokenStore;
  readonly onUnauthorized?: () => void;
  readonly timeoutMs?: number;
}

/**
 * Encapsulates authenticated HTTPS requests to the Laravel Sanctum API v1 backend.
 */
export class ApiClient {
  private readonly _config: ApiConfig;
  private readonly _tokenStore: ISecureTokenStore;
  private readonly _onUnauthorized?: () => void;
  private readonly _timeoutMs: number;
  private _resolvedDevBaseUrl: string | null = null;
  private _lastPrimaryBaseUrl: string;

  constructor(options: ApiClientOptions) {
    this._config = options.config;
    this._tokenStore = options.tokenStore;
    this._onUnauthorized = options.onUnauthorized;
    this._timeoutMs = options.timeoutMs ?? 15_000;
    this._lastPrimaryBaseUrl = this._config.baseUrl;
  }

  public get baseUrl(): string {
    if (this._lastPrimaryBaseUrl !== this._config.baseUrl) {
      this._resolvedDevBaseUrl = null;
      this._lastPrimaryBaseUrl = this._config.baseUrl;
    }
    return this._resolvedDevBaseUrl ?? this._config.baseUrl;
  }

  public async get<TResponse>(path: string): Promise<TResponse> {
    return this.request<TResponse>('GET', path);
  }

  public async post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.request<TResponse>('POST', path, body);
  }

  public async patch<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.request<TResponse>('PATCH', path, body);
  }

  public async delete<TResponse>(path: string): Promise<TResponse> {
    return this.request<TResponse>('DELETE', path);
  }

  public async postMultipart<TResponse>(path: string, formData: FormData): Promise<TResponse> {
    return this.request<TResponse>('POST', path, formData, true);
  }

  private async request<TResponse>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    isMultipart = false,
  ): Promise<TResponse> {
    const serializedBody =
      body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body);
    if (typeof serializedBody === 'string' && serializedBody.length > MAX_OUTBOUND_JSON_BYTES) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds maximum allowed size.');
    }

    if (this._lastPrimaryBaseUrl !== this._config.baseUrl) {
      this._resolvedDevBaseUrl = null;
      this._lastPrimaryBaseUrl = this._config.baseUrl;
    }

    const token = await this._tokenStore.getBearerToken();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (!isMultipart && body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const activeBase = this._resolvedDevBaseUrl ?? this._config.baseUrl;
    // Retry once on transient network socket drops (e.g. PHP CLI Keep-Alive EOF over ADB reverse) for idempotent GETs
    const maxAttempts = method === 'GET' ? 2 : 1;
    let lastNetworkError: ApiError | null = null;

    const sendAttempt = async (targetBaseUrl: string): Promise<TResponse> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this._timeoutMs);
      try {
        const response = await fetch(`${targetBaseUrl}${normalizedPath}`, {
          method,
          headers,
          body: serializedBody,
          signal: controller.signal,
        });

        const rawText = await response.text();
        if (rawText.length > MAX_RESPONSE_BYTES) {
          throw new ApiError(
            413,
            'RESPONSE_TOO_LARGE',
            'Server response exceeded maximum safe payload size.',
          );
        }

        const parsed = rawText ? this.tryParseJson(rawText) : null;

        if (!response.ok) {
          if (response.status === 401 && this._onUnauthorized) {
            this._onUnauthorized();
          }
          const retryAfterHeader = response.headers?.get?.('Retry-After');
          const parsedRetry = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
          const retryAfterSeconds =
            response.status === 429
              ? Number.isFinite(parsedRetry) && parsedRetry > 0
                ? Math.min(parsedRetry, 300)
                : 60
              : undefined;
          const message =
            (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string'
              ? parsed.message
              : null) ??
            (response.status === 429
              ? `Too many requests. Please wait ${retryAfterSeconds}s before retrying.`
              : `Server responded with HTTP ${response.status}.`);
          const code =
            (parsed && typeof parsed === 'object' && 'code' in parsed && typeof parsed.code === 'string'
              ? parsed.code
              : null) ?? (response.status === 429 ? 'RATE_LIMITED' : `HTTP_${response.status}`);
          throw new ApiError(response.status, code, message, retryAfterSeconds);
        }

        return parsed as TResponse;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiError(0, 'REQUEST_TIMEOUT', `Request timed out connecting to ${targetBaseUrl}.`);
        }
        throw new ApiError(
          0,
          'NETWORK_UNREACHABLE',
          `Unable to reach Tracely server (${targetBaseUrl}). Check connectivity or Server URL.`,
        );
      } finally {
        clearTimeout(timer);
      }
    };

    const isProxyBackendUnreachable = (error: unknown): error is ApiError =>
      error instanceof ApiError && error.status === 502 && error.code === 'BACKEND_UNREACHABLE';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await sendAttempt(activeBase);
      } catch (error) {
        if (error instanceof ApiError && error.status === 0 && error.code === 'NETWORK_UNREACHABLE') {
          lastNetworkError = error;
          if (attempt < maxAttempts) {
            await new Promise<void>((resolve) => setTimeout(resolve, 120));
            continue;
          }
          break;
        }
        if (isProxyBackendUnreachable(error)) {
          lastNetworkError = error;
          break;
        }
        throw error;
      }
    }

    // In __DEV__, if local loopback 127.0.0.1:8000 is unreachable (e.g. ADB port rotation dropped tcp:8000
    // or Laravel is running on :8080), automatically probe the Metro tunnel proxy, :8080, or LAN host for
    // reads and auth endpoints (never non-idempotent doc writes).
    const canProbeDevFallback =
      method === 'GET' || normalizedPath === '/auth/login' || normalizedPath === '/auth/register';
    if (canProbeDevFallback) {
      const hadCachedFallback = Boolean(this._resolvedDevBaseUrl);
      if (hadCachedFallback) {
        this._resolvedDevBaseUrl = null;
      }
      const fallbacks = [
        ...ApiConfig.getDevFallbackBaseUrls(this._config.baseUrl),
        ...(hadCachedFallback ? [this._config.baseUrl] : []),
      ].filter((candidate, idx, all) => candidate !== activeBase && all.indexOf(candidate) === idx);
      for (const fallbackBase of fallbacks) {
        try {
          const result = await sendAttempt(fallbackBase);
          this._resolvedDevBaseUrl = fallbackBase === this._config.baseUrl ? null : fallbackBase;
          return result;
        } catch (error) {
          if (
            (error instanceof ApiError && error.status === 0 && error.code === 'NETWORK_UNREACHABLE') ||
            isProxyBackendUnreachable(error)
          ) {
            continue;
          }
          throw error;
        }
      }
    }

    throw (
      lastNetworkError ??
      new ApiError(
        0,
        'NETWORK_UNREACHABLE',
        `Unable to reach Tracely server (${this._config.baseUrl}). Check connectivity or Server URL.`,
      )
    );
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
