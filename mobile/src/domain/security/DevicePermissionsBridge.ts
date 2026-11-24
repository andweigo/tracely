import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Permission, PermissionsAndroid, Platform } from 'react-native';
import { DeviceNotificationBridge } from './DeviceNotificationBridge';

export type DevicePermissionKey = 'camera' | 'notifications' | 'media';
export type DevicePermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

export interface DevicePermissionsSnapshot {
  readonly camera: DevicePermissionStatus;
  readonly notifications: DevicePermissionStatus;
  readonly media: DevicePermissionStatus;
}

export interface ServicePermissionsState {
  readonly liveSyncEnabled: boolean;
  readonly offlineCacheEnabled: boolean;
  readonly custodyAlertsEnabled: boolean;
}

export const DEFAULT_SERVICE_PERMISSIONS: ServicePermissionsState = {
  liveSyncEnabled: true,
  offlineCacheEnabled: true,
  custodyAlertsEnabled: true,
};

const STORAGE_KEY_SERVICE_PERMS = '@tracely/service_permissions';

function androidApiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10) || 0;
}

function resolveAndroidPermission(key: DevicePermissionKey): Permission | null {
  if (Platform.OS !== 'android') return null;
  const api = androidApiLevel();
  const perms = PermissionsAndroid?.PERMISSIONS;
  if (!perms) return null;

  if (key === 'camera') {
    return perms.CAMERA ?? null;
  }
  if (key === 'notifications') {
    return api >= 33 ? (perms.POST_NOTIFICATIONS ?? null) : null;
  }
  if (key === 'media') {
    return api >= 33
      ? (perms.READ_MEDIA_IMAGES ?? null)
      : (perms.READ_EXTERNAL_STORAGE ?? null);
  }
  return null;
}

export const DevicePermissionsBridge = {
  async checkAllDevicePermissions(): Promise<DevicePermissionsSnapshot> {
    if (Platform.OS !== 'android' || !PermissionsAndroid?.check) {
      return {
        camera: 'unavailable',
        notifications: 'unavailable',
        media: 'unavailable',
      };
    }

    const api = androidApiLevel();
    const checkOne = async (key: DevicePermissionKey): Promise<DevicePermissionStatus> => {
      if (key === 'notifications' && api > 0 && api < 33) {
        return 'granted';
      }
      const perm = resolveAndroidPermission(key);
      if (!perm) return 'unavailable';
      try {
        const granted = await PermissionsAndroid.check(perm);
        return granted ? 'granted' : 'denied';
      } catch {
        return 'unavailable';
      }
    };

    const [camera, notifications, media] = await Promise.all([
      checkOne('camera'),
      checkOne('notifications'),
      checkOne('media'),
    ]);

    return { camera, notifications, media };
  },

  async requestDevicePermission(key: DevicePermissionKey): Promise<DevicePermissionStatus> {
    if (Platform.OS !== 'android' || !PermissionsAndroid?.request) {
      return 'unavailable';
    }

    const api = androidApiLevel();
    if (key === 'notifications') {
      if (api > 0 && api < 33) return 'granted';
      const perm = resolveAndroidPermission('notifications');
      if (perm) {
        try {
          const result = await PermissionsAndroid.request(perm, {
            title: 'Tracely Custody Notifications',
            message: 'Allow notifications to receive real-time incoming document alerts.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          });
          if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
          return 'denied';
        } catch {
          const fallback = await DeviceNotificationBridge.requestPermission();
          return fallback ? 'granted' : 'denied';
        }
      }
      const fallback = await DeviceNotificationBridge.requestPermission();
      return fallback ? 'granted' : 'denied';
    }

    const perm = resolveAndroidPermission(key);
    if (!perm) return 'unavailable';

    const rationale =
      key === 'camera'
        ? {
            title: 'Tracely Camera Access',
            message: 'Allow camera access to scan QR custody slips and capture receipt proofs.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          }
        : {
            title: 'Tracely Files & Media Access',
            message: 'Allow access to attach documents and receipt photos from your device.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          };

    try {
      const result = await PermissionsAndroid.request(perm, rationale);
      if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
      return 'denied';
    } catch {
      return 'denied';
    }
  },

  async openSystemSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch {
      // Ignore if unavailable in test environment
    }
  },

  async loadServicePermissions(): Promise<ServicePermissionsState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SERVICE_PERMS);
      if (!raw) return DEFAULT_SERVICE_PERMISSIONS;
      const parsed = JSON.parse(raw) as Partial<ServicePermissionsState>;
      return {
        liveSyncEnabled: parsed.liveSyncEnabled ?? true,
        offlineCacheEnabled: parsed.offlineCacheEnabled ?? true,
        custodyAlertsEnabled: parsed.custodyAlertsEnabled ?? true,
      };
    } catch {
      return DEFAULT_SERVICE_PERMISSIONS;
    }
  },

  async saveServicePermissions(next: ServicePermissionsState): Promise<ServicePermissionsState> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SERVICE_PERMS, JSON.stringify(next));
    } catch {
      // Ignore storage error cleanly
    }
    return next;
  },
};
