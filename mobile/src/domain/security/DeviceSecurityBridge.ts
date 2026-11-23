import { NativeModules, Platform } from 'react-native';

interface DocsTrackSecurityNative {
  setScreenshotShield?: (enabled: boolean) => void;
  authenticateDevice?: (title: string, subtitle: string) => Promise<string>;
}

export type DeviceVerificationOutcome =
  | { readonly verified: true; readonly method: 'native_device_credential' }
  | { readonly verified: false; readonly method: 'in_app_required' | 'cancelled'; readonly reason?: string };

function getNativeSecurityModule(): DocsTrackSecurityNative | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules?.DocsTrackSecurity as DocsTrackSecurityNative | undefined;
  return mod ?? null;
}

/**
 * Coordinates Android FLAG_SECURE screenshot shielding and device credential verification
 * with clean in-app verification fallback when running without the native module.
 */
export const DeviceSecurityBridge = {
  applyScreenshotShield(enabled: boolean): void {
    try {
      getNativeSecurityModule()?.setScreenshotShield?.(enabled);
    } catch {
      // Ignore on environments without an active Android window
    }
  },

  async verifyDeviceAccess(title: string, subtitle: string): Promise<DeviceVerificationOutcome> {
    const mod = getNativeSecurityModule();
    if (!mod?.authenticateDevice) {
      return { verified: false, method: 'in_app_required' };
    }

    try {
      const outcome = await mod.authenticateDevice(title, subtitle);
      if (outcome === 'authenticated') {
        return { verified: true, method: 'native_device_credential' };
      }
      if (outcome === 'cancelled') {
        return {
          verified: false,
          method: 'cancelled',
          reason: 'Device verification was cancelled.',
        };
      }
      return { verified: false, method: 'in_app_required' };
    } catch {
      return { verified: false, method: 'in_app_required' };
    }
  },
};
