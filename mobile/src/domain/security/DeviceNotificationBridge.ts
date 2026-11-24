import { NativeModules, Platform } from 'react-native';

export interface DeviceNotificationPayload {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly lockScreenPreview: string;
  readonly authenticatedDetail: string;
}

interface DocsTrackNotificationsNative {
  requestNotificationPermission?: () => Promise<boolean>;
  syncDeviceNotifications?: (
    notifications: ReadonlyArray<DeviceNotificationPayload>,
    unreadCount: number,
    showLockScreenDetails: boolean,
    silentBaseline?: boolean,
  ) => void;
  clearDeviceNotifications?: () => void;
}

function getNativeNotificationsModule(): DocsTrackNotificationsNative | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules?.DocsTrackNotifications as DocsTrackNotificationsNative | undefined;
  return mod ?? null;
}

/**
 * Syncs unread custody alerts & numeric badge counts to the Android notification tray & launcher badge.
 * Safe no-op in Jest and on platforms without the native module.
 */
export const DeviceNotificationBridge = {
  async requestPermission(): Promise<boolean> {
    const mod = getNativeNotificationsModule();
    if (!mod?.requestNotificationPermission) return false;
    try {
      return await mod.requestNotificationPermission();
    } catch {
      return false;
    }
  },

  syncNotifications(
    unreadNotifications: ReadonlyArray<DeviceNotificationPayload>,
    unreadCount: number,
    showLockScreenDetails: boolean,
    silentBaseline = false,
  ): void {
    try {
      getNativeNotificationsModule()?.syncDeviceNotifications?.(
        unreadNotifications,
        unreadCount,
        showLockScreenDetails,
        silentBaseline,
      );
    } catch {
      // Ignore native notification failures cleanly
    }
  },

  clearNotifications(): void {
    try {
      getNativeNotificationsModule()?.clearDeviceNotifications?.();
    } catch {
      // Ignore native cleanup errors cleanly
    }
  },
};
