import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentCategory } from '../../domain/entities/DocumentCategory';
import { OfficeSummary } from '../../domain/entities/Personnel';
import type { DocumentTrackingSnapshot } from '../../domain/security/AccessPolicy';

const WORKSPACE_CACHE_PREFIX = '@tracely/workspace_cache_';

interface CachedCategoryPayload {
  id: string;
  name: string;
  code: string;
  declaredByOfficeCode: string;
  declaredByOfficeName: string;
  usageCount: number;
}

interface StoredWorkspaceCache {
  savedAt: string;
  trackedSnapshots: DocumentTrackingSnapshot[];
  categories: CachedCategoryPayload[];
  offices: OfficeSummary[];
}

export interface HydratedWorkspaceCache {
  readonly savedAt: string;
  readonly trackedSnapshots: ReadonlyArray<DocumentTrackingSnapshot>;
  readonly categories: ReadonlyArray<DocumentCategory>;
  readonly offices: ReadonlyArray<OfficeSummary>;
}

/**
 * Per-user AsyncStorage offline read cache for Mobile.
 * Persists privacy-safe tracking snapshots, categories, and office directory so
 * staff can inspect routing timelines offline without exposing raw confidential files.
 */
export class AsyncWorkspaceCacheStore {
  public static async save(
    userId: string,
    payload: {
      trackedSnapshots: ReadonlyArray<DocumentTrackingSnapshot>;
      categories: ReadonlyArray<DocumentCategory>;
      offices: ReadonlyArray<OfficeSummary>;
    },
  ): Promise<void> {
    if (!userId) return;
    const record: StoredWorkspaceCache = {
      savedAt: new Date().toISOString(),
      trackedSnapshots: [...payload.trackedSnapshots],
      categories: payload.categories.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        declaredByOfficeCode: c.declaredByOfficeCode,
        declaredByOfficeName: c.declaredByOfficeName,
        usageCount: c.usageCount,
      })),
      offices: [...payload.offices],
    };
    try {
      await AsyncStorage.setItem(`${WORKSPACE_CACHE_PREFIX}${userId}`, JSON.stringify(record));
    } catch {
      // Ignore storage quota restrictions
    }
  }

  public static async load(userId: string): Promise<HydratedWorkspaceCache | null> {
    if (!userId) return null;
    try {
      const raw = await AsyncStorage.getItem(`${WORKSPACE_CACHE_PREFIX}${userId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredWorkspaceCache>;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
        trackedSnapshots: Array.isArray(parsed.trackedSnapshots) ? parsed.trackedSnapshots : [],
        categories: Array.isArray(parsed.categories)
          ? parsed.categories.map((c) => new DocumentCategory(c))
          : [],
        offices: Array.isArray(parsed.offices) ? parsed.offices : [],
      };
    } catch {
      return null;
    }
  }

  public static async clear(userId?: string | null): Promise<void> {
    if (!userId) return;
    try {
      await AsyncStorage.removeItem(`${WORKSPACE_CACHE_PREFIX}${userId}`);
    } catch {
      // Ignore storage cleanup error
    }
  }
}
