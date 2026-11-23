import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SECURITY_PREFERENCES,
  UserSecurityPreferences,
} from '../../domain/entities/UserSecurityProfile';
import type { ISecurityPrefsStore } from '../contracts/ISecurityPrefsStore';

const STORAGE_KEY_SECURITY_PREFS = '@sdo_doctrack/security_prefs';

export class AsyncSecurityPrefsStore implements ISecurityPrefsStore {
  public async loadPrefs(): Promise<UserSecurityPreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SECURITY_PREFS);
      if (!raw) return DEFAULT_SECURITY_PREFERENCES;
      const parsed = JSON.parse(raw) as Partial<UserSecurityPreferences>;
      return Object.freeze({
        biometricGateEnabled: Boolean(parsed.biometricGateEnabled),
        hideLockScreenTitles:
          parsed.hideLockScreenTitles !== undefined ? Boolean(parsed.hideLockScreenTitles) : true,
        screenshotShieldEnabled:
          parsed.screenshotShieldEnabled !== undefined
            ? Boolean(parsed.screenshotShieldEnabled)
            : true,
      });
    } catch {
      return DEFAULT_SECURITY_PREFERENCES;
    }
  }

  public async savePrefs(prefs: UserSecurityPreferences): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_SECURITY_PREFS, JSON.stringify(prefs));
  }
}
