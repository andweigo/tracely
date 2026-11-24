import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { DomainRuleError } from '../domain/base/DomainRuleError';

const STORAGE_KEY_API_URL = '@sdo_doctrack/api_base_url';
export const PRODUCTION_API_BASE_URL =
  'https://backend-production-43015d9a.up.railway.app/api/v1';
export const LOCAL_DEV_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
export const DEFAULT_API_BASE_URL =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? LOCAL_DEV_API_BASE_URL
    : PRODUCTION_API_BASE_URL;

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

  constructor(initialBaseUrl: string = DEFAULT_API_BASE_URL) {
    this._baseUrl = ApiConfig.normalizeAndValidate(initialBaseUrl);
  }

  public get baseUrl(): string {
    return this._baseUrl;
  }

  public async loadSavedBaseUrl(): Promise<string> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
      if (saved) {
        const normalized = ApiConfig.normalizeAndValidate(saved);
        if (
          normalized.startsWith('https://api.tracely.app') ||
          normalized.startsWith('https://doctrack.depedormin.gov.ph')
        ) {
          await AsyncStorage.removeItem(STORAGE_KEY_API_URL);
          this._baseUrl = DEFAULT_API_BASE_URL;
          return this._baseUrl;
        }
        this._baseUrl = normalized;
      }
    } catch {
      // Keep default endpoint if storage read fails
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
    this._baseUrl = DEFAULT_API_BASE_URL;
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
