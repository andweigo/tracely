import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  FileCheck2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

interface OrbitCard {
  readonly id: string;
  readonly slot: 'top-left' | 'front-left' | 'right' | 'back-left' | 'back-right';
  readonly title: string;
  readonly subtitle: string;
  readonly tone: 'teal' | 'navy' | 'amber' | 'emerald' | 'slate';
  readonly icon: React.ReactNode;
  readonly detail: string;
}

const ORBIT_CARDS: ReadonlyArray<OrbitCard> = [
  {
    id: 'qr',
    slot: 'top-left',
    title: 'QR Custody',
    subtitle: 'Sealed until recipient scans.',
    tone: 'teal',
    icon: <QrCode size={15} />,
    detail: 'Opaque QR tokens prevent sender self-receipt and misrouted handoffs.',
  },
  {
    id: 'sha',
    slot: 'front-left',
    title: 'SHA-256',
    subtitle: 'Verify every file & revision.',
    tone: 'navy',
    icon: <ShieldCheck size={15} />,
    detail: 'Cryptographic file fingerprints audited across every uploaded version.',
  },
  {
    id: 'sla',
    slot: 'right',
    title: 'SLA Watch',
    subtitle: 'Turn deadlines into clarity.',
    tone: 'amber',
    icon: <Clock size={15} />,
    detail: 'Automated On Track, Due Soon, and Overdue tracking with leave delegates.',
  },
  {
    id: 'audit',
    slot: 'back-left',
    title: 'TRC-2026-00418',
    subtitle: 'Records → Finance',
    tone: 'slate',
    icon: <FileCheck2 size={14} />,
    detail: 'Immutable timestamped ledger for physical folders and digital packets.',
  },
  {
    id: 'approved',
    slot: 'back-right',
    title: 'Approved',
    subtitle: 'Verified · 2h 41m',
    tone: 'emerald',
    icon: <CheckCircle2 size={14} />,
    detail: 'Complete custody history exportable to A4 executive reports & CSV.',
  },
];

const UNIT_BADGES = [
  { code: 'REC', bg: '#0D3472', fg: '#FFFFFF' },
  { code: 'FIN', bg: '#0F766E', fg: '#FFFFFF' },
  { code: 'EXC', bg: '#F3B32A', fg: '#0D1B3E' },
] as const;

const TRUST_UNITS = [
  { code: 'REC', bg: '#0D3472', fg: '#FFFFFF' },
  { code: 'BUD', bg: '#164A9E', fg: '#FFFFFF' },
  { code: 'HR', bg: '#0F766E', fg: '#FFFFFF' },
  { code: 'ICT', bg: '#F3B32A', fg: '#0D1B3E' },
] as const;

export const OrbitalHeroStage: React.FC = () => {
  const [pinnedCardId, setPinnedCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const activeCardId = pinnedCardId ?? hoveredCardId;
  const activeCard = ORBIT_CARDS.find((c) => c.id === activeCardId) ?? null;

  return (
    <div className="orbital-stage" aria-label="Tracely editorial custody showcase">
      {/* Delicate curved SVG connectors flowing from tilted side cards to centerpiece */}
      <svg
        className="orbital-arcs"
        viewBox="0 0 1120 380"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 142 86 C 150 248, 310 292, 426 262"
          stroke="rgba(13, 52, 114, 0.16)"
          strokeWidth="1.25"
        />
        <path
          d="M 974 132 C 942 266, 792 298, 686 262"
          stroke="rgba(13, 52, 114, 0.16)"
          strokeWidth="1.25"
        />
      </svg>

      {/* Left floating slightly-tilted glass card */}
      <div className="float-card float-card-left">
        <div className="float-icon-badge">
          <Activity size={16} />
        </div>
        <h3>Turn folders into live trails.</h3>
        <p>Scan, organize, and verify custody across offices.</p>
      </div>

      {/* Right floating slightly-tilted glass card */}
      <div className="float-card float-card-right">
        <div className="unit-avatar-stack" aria-hidden="true">
          {UNIT_BADGES.map((u) => (
            <span
              key={u.code}
              className="unit-avatar"
              style={{ background: u.bg, color: u.fg }}
            >
              {u.code}
            </span>
          ))}
          <span className="unit-avatar unit-avatar-plus">+</span>
        </div>
        <h3>Synced, anytime, anywhere.</h3>
        <p>Web workspace &amp; Android across all your devices.</p>
      </div>

      {/* Center editorial portrait + 3D orbiting frosted glass cards */}
      <div className="orbital-center">
        <div className="portrait-halo" aria-hidden="true" />
        <img
          src="/hero-editorial.png"
          alt="Poised office professional surrounded by Tracely QR custody tracking cards"
          className="orbital-portrait"
        />

        <div className="orbit-ring" aria-label="Interactive Tracely capability cards">
          {ORBIT_CARDS.map((card) => {
            const isSelected = activeCardId === card.id;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={pinnedCardId === card.id}
                className={`orbit-card orbit-${card.slot} ${isSelected ? 'is-selected' : ''}`}
                onClick={() =>
                  setPinnedCardId((prev) => (prev === card.id ? null : card.id))
                }
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId((prev) => (prev === card.id ? null : prev))}
              >
                <span className={`orbit-icon tone-${card.tone}`}>{card.icon}</span>
                <span className="orbit-copy">
                  <strong>{card.title}</strong>
                  <span>{card.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        {activeCard ? (
          <div className="orbit-tooltip" role="status">
            <strong>{activeCard.title}</strong>
            <span>{activeCard.detail}</span>
          </div>
        ) : null}
      </div>

      {/* Bottom-left editorial micro-trust block */}
      <div className="editorial-corner corner-left">
        <span className="corner-rule" aria-hidden="true" />
        <p>Built for agencies &amp; enterprise teams.</p>
        <div className="unit-avatar-stack compact" aria-hidden="true">
          {TRUST_UNITS.map((u) => (
            <span
              key={u.code}
              className="unit-avatar sm"
              style={{ background: u.bg, color: u.fg }}
            >
              {u.code}
            </span>
          ))}
          <span className="unit-avatar sm unit-avatar-plus">+</span>
        </div>
      </div>

      {/* Bottom-right editorial micro-motto */}
      <div className="editorial-corner corner-right">
        <svg className="corner-star" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2L14.3 9.7L22 12L14.3 14.3L12 22L9.7 14.3L2 12L9.7 9.7L12 2Z"
            fill="#0D3472"
          />
        </svg>
        <div className="corner-motto">
          <span className="corner-rule" aria-hidden="true" />
          <p>
            Less paper chaos.
            <br />
            More clarity.
          </p>
        </div>
      </div>
    </div>
  );
};
