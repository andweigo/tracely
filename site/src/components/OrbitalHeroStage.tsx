import React, { useState } from 'react';

interface OrbitCard {
  readonly id: string;
  readonly slot: 'top-left' | 'front-left' | 'right' | 'back-left' | 'back-right';
  readonly code: string;
  readonly title: string;
  readonly subtitle: string;
  readonly detail: string;
}

const ORBIT_CARDS: ReadonlyArray<OrbitCard> = [
  {
    id: 'qr',
    slot: 'top-left',
    code: '01',
    title: 'QR Handoff',
    subtitle: 'Sealed until recipient scans',
    detail: 'Private QR slips ensure only the receiving office can confirm custody.',
  },
  {
    id: 'sha',
    slot: 'front-left',
    code: '02',
    title: 'Verified Files',
    subtitle: 'Checked on every revision',
    detail: 'Uploaded files and revisions are checked automatically so edits never go unnoticed.',
  },
  {
    id: 'sla',
    slot: 'right',
    code: '03',
    title: 'Deadlines',
    subtitle: 'Flagged before due dates slip',
    detail: 'Monitor turnaround times per office with out-of-office delegate handoffs.',
  },
  {
    id: 'audit',
    slot: 'back-left',
    code: '04',
    title: 'Budget Proposal',
    subtitle: 'Records → Finance',
    detail: 'Timestamped handoff ledger for physical folders and digital packets.',
  },
  {
    id: 'approved',
    slot: 'back-right',
    code: '05',
    title: 'Approved',
    subtitle: 'Logged · 2h 41m',
    detail: 'Export full custody histories as printable summaries or CSV logs.',
  },
];

const OFFICE_STAMPS = ['REC', 'FIN', 'EXC'] as const;
const TRUST_STAMPS = ['REC', 'BUD', 'HR', 'ICT'] as const;

export const OrbitalHeroStage: React.FC = () => {
  const [pinnedCardId, setPinnedCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const activeCardId = pinnedCardId ?? hoveredCardId;
  const activeCard = ORBIT_CARDS.find((c) => c.id === activeCardId) ?? null;

  return (
    <div className="orbital-stage" aria-label="Tracely editorial custody showcase">
      {/* Subtle architectural hairline connectors */}
      <svg
        className="orbital-arcs"
        viewBox="0 0 1120 380"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 142 86 C 150 248, 310 292, 426 262"
          stroke="rgba(15, 27, 51, 0.14)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <path
          d="M 974 132 C 942 266, 792 298, 686 262"
          stroke="rgba(15, 27, 51, 0.14)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      </svg>

      {/* Left floating archival index slip */}
      <div className="float-card float-card-left">
        <div className="float-slip-meta">
          <span className="slip-index">LOG · 01</span>
          <span className="slip-dot" aria-hidden="true" />
        </div>
        <h3>Turn folders into live trails.</h3>
        <p>Scan, organize, and verify custody across offices.</p>
      </div>

      {/* Right floating office stamp slip */}
      <div className="float-card float-card-right">
        <div className="office-stamp-row" aria-hidden="true">
          {OFFICE_STAMPS.map((code) => (
            <span key={code} className="office-stamp">
              {code}
            </span>
          ))}
        </div>
        <h3>Synced across desks &amp; phones.</h3>
        <p>Web workspace &amp; Android always on the same ledger.</p>
      </div>

      {/* Center editorial portrait + interactive paper routing tags */}
      <div className="orbital-center">
        <img
          src="/hero-editorial.png"
          alt="Office staff surrounded by Tracely QR document routing slips"
          className="orbital-portrait"
        />

        <div className="orbit-ring" aria-label="Interactive Tracely capability tags">
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
                <span className="orbit-index" aria-hidden="true">
                  {card.code}
                </span>
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

      {/* Bottom-left editorial colophon */}
      <div className="editorial-corner corner-left">
        <span className="corner-rule" aria-hidden="true" />
        <p>Built for public agencies &amp; multi-office teams.</p>
        <div className="office-stamp-row compact" aria-hidden="true">
          {TRUST_STAMPS.map((code) => (
            <span key={code} className="office-stamp sm">
              {code}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom-right editorial motto */}
      <div className="editorial-corner corner-right">
        <span className="corner-kicker">CUSTODY RECORD</span>
        <div className="corner-motto">
          <span className="corner-rule" aria-hidden="true" />
          <p>
            Less paper guesswork.
            <br />
            Clearer handoffs.
          </p>
        </div>
      </div>
    </div>
  );
};
