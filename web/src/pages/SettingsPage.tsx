import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  ChevronRight,
  Code2,
  Cpu,
  FileText,
  FolderKanban,
  Info,
  Layers,
  LogOut,
  Palette,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { AppIconBadge } from '../components/AppIconBadge';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { LegalDocumentType } from '../domain/legalPolicies';
import { useWebApp } from '../state/WebAppContext';

type BrowserPermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const SYSTEM_CAPABILITIES: ReadonlyArray<{
  readonly title: string;
  readonly detail: string;
}> = [
  {
    title: 'Verified QR Custody & Sealed Transfers',
    detail: 'Track physical and digital document handoffs with tamper-evident receipt verification.',
  },
  {
    title: 'Routing Flow Analytics',
    detail: 'Visualize per-user and per-office outgoing document corridors and active transit volume.',
  },
  {
    title: 'High-Scale Interactive 3D Desk Folders',
    detail: 'Organize active records with priority sheets and searchable paginated folder ledgers.',
  },
  {
    title: 'Privacy Controls & Cross-Device Sync',
    detail: 'Protect restricted records with privacy masking and synchronized workspace preferences.',
  },
];

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
      style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}
    >
      {/* System Identity Banner */}
      <div
        className="card"
        style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      >
        <AppIconBadge size={52} animated interactive />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            Tracely
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Document Custody, Routing &amp; QR Tracking Workspace
          </p>
        </div>
        <span className="pill pill-sky" style={{ fontSize: 11 }}>
          v1.0.7
        </span>
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
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              DEVICE ACCESS
            </span>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Bell size={15} color="var(--navy)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Browser Notifications
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Receive real-time incoming document alerts
                  </div>
                </div>
              </div>
              {notifPerm === 'granted' ? (
                <span className="pill pill-emerald" style={{ fontSize: 11 }}>
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
                    Camera Access
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Optional camera verification for QR capture
                  </div>
                </div>
              </div>
              {cameraPerm === 'granted' ? (
                <span className="pill pill-emerald" style={{ fontSize: 11 }}>
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
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
              ACTIVE SERVICES
            </span>

            <label className="switch-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Desktop Custody Alerts</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Show live alerts when new transfers arrive
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
                  Mask document titles inside alert previews
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
                <div style={{ fontSize: 13, fontWeight: 700 }}>Confidential File Verification</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Require verification before opening confidential records
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

      {/* System Information (Public-Safe, Zero Secrets) */}
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
              <strong className="mono">1.0.7</strong>
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
              <strong>Web Workspace Portal</strong>
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
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--text-secondary)',
                }}
              >
                <Cpu size={14} /> Architecture
              </span>
              <strong>Encrypted Workspace · QR Ledger</strong>
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
                <ShieldCheck size={14} color="var(--emerald-text)" /> Security Model
              </span>
              <strong>TLS · RBAC · Privacy Masking</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="var(--navy)" />
              <h4 className="section-title" style={{ fontSize: 15 }}>
                Core Capabilities
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SYSTEM_CAPABILITIES.map((cap, idx) => (
                <div
                  key={cap.title}
                  className="card-soft"
                  style={{ padding: 11, display: 'flex', alignItems: 'flex-start', gap: 10 }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'var(--surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {idx % 2 === 0 ? (
                      <QrCode size={14} color="var(--navy)" />
                    ) : (
                      <FolderKanban size={14} color="var(--navy)" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {cap.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {cap.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 className="section-title" style={{ fontSize: 15 }}>
              Workspace &amp; Legal
            </h4>
            <button
              type="button"
              className="btn btn-soft"
              style={{ justifyContent: 'space-between', width: '100%' }}
              onClick={() => navigate('user_profile')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Palette size={15} /> Profile Theme &amp; Lanyard Color
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
                <ShieldCheck size={15} /> Availability &amp; Account Security
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
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Tracely · Designed &amp; Developed by Andrei Obligar
      </p>

      <LegalPolicyModal
        open={legalModalTab !== null}
        initialTab={legalModalTab ?? 'terms'}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
};

export default SettingsPage;
