import React from 'react';
import {
  ChevronRight,
  Code2,
  Cpu,
  FolderKanban,
  Info,
  Layers,
  Palette,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { AppIconBadge } from '../components/AppIconBadge';
import { useWebApp } from '../state/WebAppContext';

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

export const SettingsPage: React.FC = () => {
  const { navigate } = useWebApp();

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
          v1.0.0
        </span>
      </div>

      {/* System Information (Public-Safe, Zero Company or System Secrets) */}
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
              <strong className="mono">1.0.0</strong>
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
              Workspace Preferences
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
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Tracely · Designed &amp; Developed by Andrei Obligar
      </p>
    </div>
  );
};

export default SettingsPage;
