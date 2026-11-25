import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  ChevronRight,
  Code2,
  FileText,
  Folder,
  Info,
  LogOut,
  Palette,
  ShieldCheck,
} from 'lucide-react';
import { AppIconBadge } from '../components/AppIconBadge';
import { Folder as FolderPreview } from '../components/Folder';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { LegalDocumentType } from '../domain/legalPolicies';
import { useWebApp } from '../state/WebAppContext';

type BrowserPermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

function readNotificationPermission(): BrowserPermState {
  if (typeof window === 'undefined' || !window.Notification) return 'unsupported';
  const perm = window.Notification.permission;
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'prompt';
}

export const SettingsPage: React.FC = () => {
  const {
    actor,
    navigate,
    signOut,
    userPreferences,
    updateUserPreferences,
    folderAppearance,
    updateFolderAppearance,
    securityPrefs,
    updateSecurityPrefs,
    notify,
  } = useWebApp();

  const [notifPerm, setNotifPerm] = useState<BrowserPermState>(() => readNotificationPermission());
  const [cameraPerm, setCameraPerm] = useState<BrowserPermState>('prompt');
  const [legalModalTab, setLegalModalTab] = useState<LegalDocumentType | null>(null);

  const probeBrowserPermissions = useCallback(async () => {
    setNotifPerm(readNotificationPermission());
    if (typeof navigator === 'undefined') {
      setCameraPerm('unsupported');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPerm('unsupported');
      return;
    }
    try {
      const permsApi = navigator.permissions;
      if (permsApi?.query) {
        const res = await permsApi.query({ name: 'camera' as PermissionName });
        if (res.state === 'granted' || res.state === 'denied' || res.state === 'prompt') {
          setCameraPerm(res.state);
          return;
        }
      }
      setCameraPerm('prompt');
    } catch {
      setCameraPerm('prompt');
    }
  }, []);

  useEffect(() => {
    void probeBrowserPermissions();
  }, [probeBrowserPermissions]);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !window.Notification?.requestPermission) {
      notify('info', 'Browser notifications are not supported on this device.');
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      const mapped: BrowserPermState =
        result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt';
      setNotifPerm(mapped);
      if (mapped === 'granted') {
        notify('success', 'Browser notifications enabled.');
      } else if (mapped === 'denied') {
        notify('info', 'Notifications are blocked in your browser site settings.');
      }
    } catch {
      notify('error', 'Unable to update notification permission.');
    }
  };

  const handleRequestCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      notify('info', 'Camera access is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPerm('granted');
      notify('success', 'Camera access enabled.');
    } catch {
      setCameraPerm('denied');
      notify('info', 'Camera access was declined or blocked in browser settings.');
    }
  };

  return (
    <div
      data-testid="web-settings-page"
      style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 880 }}
    >
      {/* System Identity Header */}
      <div
        className="card"
        style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      >
        <AppIconBadge size={48} animated interactive />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            Tracely
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            v1.0.11
          </p>
        </div>
      </div>

      {/* Folder Appearance Preferences (Dashboard + Categories) */}
      <div
        className="card"
        data-testid="web-settings-folder-prefs-card"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Folder size={16} color="var(--navy)" />
          <h4 className="section-title" style={{ fontSize: 15 }}>
            Folder Design
          </h4>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0 4px',
          }}
        >
          <FolderPreview
            color="#0ea5e9"
            size={0.82}
            mode={folderAppearance.mode}
            variant={folderAppearance.variant}
            layout={folderAppearance.layout}
            intro={false}
            items={[
              { title: 'Budget Memo', description: 'FIN · Preview sheet' },
              { title: 'Travel Order', description: 'HR · Preview sheet' },
            ]}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12,
          }}
        >
          <div className="card-soft" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Folder Style
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['flap', 'book'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`web-pref-folder-mode-${m}`}
                  className={folderAppearance.mode === m ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, minHeight: 34, padding: '4px 10px', fontSize: 12, textTransform: 'capitalize' }}
                  onClick={() => updateFolderAppearance({ mode: m })}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="card-soft" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Folder Surface
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['solid', 'glass', 'matte'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`web-pref-folder-variant-${v}`}
                  className={folderAppearance.variant === v ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, minHeight: 34, padding: '4px 8px', fontSize: 12, textTransform: 'capitalize' }}
                  onClick={() => updateFolderAppearance({ variant: v })}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="card-soft" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Sheet Layout
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['spread', 'stack', 'row'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  data-testid={`web-pref-folder-layout-${l}`}
                  className={folderAppearance.layout === l ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, minHeight: 34, padding: '4px 8px', fontSize: 12, textTransform: 'capitalize' }}
                  onClick={() => updateFolderAppearance({ layout: l })}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Device & Service Permissions */}
      <div
        className="card"
        data-testid="web-settings-permissions-card"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color="var(--navy)" />
          <h4 className="section-title" style={{ fontSize: 15 }}>
            Device &amp; Service Permissions
          </h4>
        </div>

        <div className="profile-grid">
          <div className="card-soft" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
              Device Access
            </span>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Bell size={15} color="var(--navy)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Notifications
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Incoming document alerts
                  </div>
                </div>
              </div>
              {notifPerm === 'granted' ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--emerald-text)' }}>
                  Allowed
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="web-perm-notifications-btn"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => void handleRequestNotifications()}
                >
                  {notifPerm === 'denied'
                    ? 'Blocked'
                    : notifPerm === 'unsupported'
                      ? 'Unavailable'
                      : 'Allow'}
                </button>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Camera size={15} color="var(--navy)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Camera
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Scan QR codes
                  </div>
                </div>
              </div>
              {cameraPerm === 'granted' ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--emerald-text)' }}>
                  Allowed
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="web-perm-camera-btn"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => void handleRequestCamera()}
                >
                  {cameraPerm === 'denied'
                    ? 'Blocked'
                    : cameraPerm === 'unsupported'
                      ? 'Unavailable'
                      : 'Allow'}
                </button>
              )}
            </div>
          </div>

          <div className="card-soft" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
              Services
            </span>

            <label className="switch-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Desktop Alerts</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Show alerts for new transfers
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={userPreferences.desktopNotifications}
                  onChange={(e) => void updateUserPreferences({ desktopNotifications: e.target.checked })}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>

            <label className="switch-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Hide Titles on Lock Screen</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Keep alert previews private
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={userPreferences.hideLockScreenTitles}
                  onChange={(e) => void updateUserPreferences({ hideLockScreenTitles: e.target.checked })}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>

            <label className="switch-row" style={{ padding: '6px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Confidential File Lock</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Verify before opening restricted files
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={securityPrefs.biometricLock}
                  onChange={(e) => updateSecurityPrefs({ biometricLock: e.target.checked })}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* System Information & Account Links */}
      <div className="profile-grid">
        <div
          className="card"
          data-testid="web-system-info-card"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} color="var(--navy)" />
            <h4 className="section-title" style={{ fontSize: 15 }}>
              System Information
            </h4>
          </div>

          <div
            className="card-soft"
            style={{ padding: '4px 14px', display: 'flex', flexDirection: 'column' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Application</span>
              <strong>Tracely</strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Version</span>
              <strong className="mono">1.0.8</strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Platform</span>
              <strong>Web Portal</strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                fontSize: 13,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--text-secondary)',
                }}
              >
                <Code2 size={14} /> Developer
              </span>
              <strong data-testid="web-system-developer" style={{ color: 'var(--navy)' }}>
                Andrei Obligar
              </strong>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 className="section-title" style={{ fontSize: 15 }}>
            Account &amp; Legal
          </h4>
          <button
            type="button"
            className="btn btn-soft"
            style={{ justifyContent: 'space-between', width: '100%' }}
            onClick={() => navigate('user_profile')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Palette size={15} /> Profile &amp; ID Color
            </span>
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className="btn btn-soft"
            style={{ justifyContent: 'space-between', width: '100%' }}
            onClick={() => navigate('profile')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={15} /> Security &amp; Availability
            </span>
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            data-testid="web-settings-terms-btn"
            className="btn btn-soft"
            style={{ justifyContent: 'space-between', width: '100%' }}
            onClick={() => setLegalModalTab('terms')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} /> Terms &amp; Conditions
            </span>
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            data-testid="web-settings-privacy-btn"
            className="btn btn-soft"
            style={{ justifyContent: 'space-between', width: '100%' }}
            onClick={() => setLegalModalTab('privacy')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={15} /> Privacy Policy
            </span>
            <ChevronRight size={15} />
          </button>

          {actor ? (
            <button
              type="button"
              data-testid="web-settings-signout-btn"
              className="btn btn-danger-outline"
              style={{ width: '100%', marginTop: 4 }}
              onClick={() => void signOut()}
            >
              <LogOut size={14} /> Sign Out
            </button>
          ) : null}
        </div>
      </div>

      <LegalPolicyModal
        open={legalModalTab !== null}
        initialTab={legalModalTab ?? 'terms'}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
};

export default SettingsPage;
