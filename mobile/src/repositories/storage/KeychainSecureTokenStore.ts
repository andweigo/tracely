import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type {
  ISecureTokenStore,
  SecureSessionRecord,
} from '../contracts/ISecureTokenStore';

const KEYCHAIN_SERVICE = 'ph.gov.deped.orientalmindoro.doctrack.sanctum';
const CACHE_META_KEY = '@sdo_doctrack/session_meta';
const OFFLINE_QUEUE_KEY = '@sdo_doctrack/offline_queue';

/**
 * Hardware-backed Android Keystore / iOS Keychain Sanctum token store.
 */
export class KeychainSecureTokenStore implements ISecureTokenStore {
  public async getSession(): Promise<SecureSessionRecord | null> {
    const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!credentials || !credentials.password) {
      return null;
    }

    const rawMeta = await AsyncStorage.getItem(CACHE_META_KEY);
    if (!rawMeta) return null;

    try {
      const parsed = JSON.parse(rawMeta) as SecureSessionRecord;
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        await this.clearAndWipeAllLocalCache();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public async getBearerToken(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!credentials || !credentials.password) return null;
    return credentials.password;
  }

  public async saveSession(bearerToken: string, session: SecureSessionRecord): Promise<void> {
    await Keychain.setGenericPassword(session.userId, bearerToken, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(session));
  }

  public async clearAndWipeAllLocalCache(): Promise<void> {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    await AsyncStorage.removeMany([CACHE_META_KEY, OFFLINE_QUEUE_KEY]);
  }
}
