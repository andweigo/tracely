import type { UserSecurityPreferences } from '../../domain/entities/UserSecurityProfile';

export interface ISecurityPrefsStore {
  loadPrefs(): Promise<UserSecurityPreferences>;
  savePrefs(prefs: UserSecurityPreferences): Promise<void>;
}
