import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { DomainRuleError } from '../domain/base/DomainRuleError';

const STORAGE_KEY_API_URL = '@sdo_doctrack/api_base_url';
export const MOBILE_APP_VERSION = '1.0.7';
export const PRODUCTION_API_BASE_URL =
  'https://backend-production-43015d9a.up.railway.app/api/v1';
export const LOCAL_DEV_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export function isNewerAppVersion(latest: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export function getDefaultApiBaseUrl(): string {
  return typeof __DEV__ !== 'undefined' && __DEV__
    ? LOCAL_DEV_API_BASE_URL
    : PRODUCTION_API_BASE_URL;
}

export const DEFAULT_API_BASE_URL = getDefaultApiBaseUrl();

/**
 * Auth gate flag for mobile-first UI build before Laravel Sanctum auth endpoints are connected.
 * Flip to `true` once backend login & user sessions are live.
 */
export const AUTH_REQUIRED = true;

/**
 * Encapsulates validated backend API endpoint configuration with HTTPS enforcement
 * for non-local hosts (allowing localhost/10.0.2.2 only for local ADB tunneling).
 */
export class ApiConfig {
  private _baseUrl: string;

  constructor(initialBaseUrl: string = getDefaultApiBaseUrl()) {
    this._baseUrl = ApiConfig.normalizeAndValidate(initialBaseUrl);
  }

  public get baseUrl(): string {
    return this._baseUrl;
  }

  public async loadSavedBaseUrl(): Promise<string> {
    const defaultUrl = getDefaultApiBaseUrl();
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
      if (saved) {
        const normalized = ApiConfig.normalizeAndValidate(saved);
        const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;
        const isLegacyPlaceholder =
          normalized.startsWith('https://api.tracely.app') ||
          normalized.startsWith('https://doctrack.depedormin.gov.ph');
        const isLocalHttp = normalized.startsWith('http://');

        if (isLegacyPlaceholder || (!isDevBuild && isLocalHttp)) {
          await AsyncStorage.removeItem(STORAGE_KEY_API_URL);
          this._baseUrl = defaultUrl;
          return this._baseUrl;
        }
        this._baseUrl = normalized;
      }
    } catch {
      this._baseUrl = defaultUrl;
    }
    return this._baseUrl;
  }

  public async setBaseUrl(rawUrl: string): Promise<string> {
    const validated = ApiConfig.normalizeAndValidate(rawUrl);
    this._baseUrl = validated;
    await AsyncStorage.setItem(STORAGE_KEY_API_URL, validated);
    return validated;
  }

  public async resetBaseUrl(): Promise<void> {
    this._baseUrl = getDefaultApiBaseUrl();
    await AsyncStorage.removeItem(STORAGE_KEY_API_URL);
  }

  public static normalizeAndValidate(rawUrl: string): string {
    const trimmed = rawUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      throw new DomainRuleError('INVALID_API_URL', 'API base URL cannot be empty.');
    }

    const isHttps = trimmed.startsWith('https://');
    const isLocalHttp =
      trimmed.startsWith('http://localhost') ||
      trimmed.startsWith('http://127.0.0.1') ||
      trimmed.startsWith('http://10.0.2.2');
    const isDevLanHttp =
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?(\/|$)/.test(
        trimmed,
      );

    if (!isHttps && !isLocalHttp && !isDevLanHttp) {
      throw new DomainRuleError(
        'INSECURE_TRANSPORT',
        'Production Tracely endpoints must use HTTPS (plain HTTP is allowed only for localhost/ADB tunnel or dev LAN).',
      );
    }

    return trimmed;
  }

  public static getDevFallbackBaseUrls(primaryBaseUrl: string): string[] {
    if (typeof __DEV__ === 'undefined' || !__DEV__) {
      return [];
    }

    let normalized = primaryBaseUrl;
    try {
      normalized = ApiConfig.normalizeAndValidate(primaryBaseUrl);
    } catch {
      return [];
    }

    const isLoopbackTarget =
      normalized.startsWith('http://127.0.0.1:8000') ||
      normalized.startsWith('http://localhost:8000') ||
      normalized.startsWith('http://10.0.2.2:8000') ||
      normalized.startsWith('http://127.0.0.1:8080') ||
      normalized.startsWith('http://localhost:8080') ||
      normalized.startsWith('http://10.0.2.2:8080');

    if (!isLoopbackTarget) {
      return [];
    }

    const candidates: string[] = [];
    const scriptUrl = NativeModules?.SourceCode?.getConstants?.()?.scriptURL as
      | string
      | undefined;
    if (typeof scriptUrl === 'string') {
      const match = scriptUrl.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
      const metroHost = match?.[1];
      if (
        metroHost &&
        metroHost !== 'localhost' &&
        metroHost !== '127.0.0.1' &&
        metroHost !== '10.0.2.2'
      ) {
        candidates.push(`http://${metroHost}:8000/api/v1`);
        candidates.push(`http://${metroHost}:8080/api/v1`);
      }
    }

    candidates.push('http://127.0.0.1:8081/__doctrack_api/v1');
    candidates.push('http://127.0.0.1:8080/api/v1');
    candidates.push('http://127.0.0.1:8000/api/v1');
    candidates.push('http://10.0.2.2:8000/api/v1');
    candidates.push('http://10.0.2.2:8080/api/v1');

    return candidates.filter((url, idx) => url !== normalized && candidates.indexOf(url) === idx);
  }
}
