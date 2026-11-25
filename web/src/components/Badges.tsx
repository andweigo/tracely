import React from 'react';
import { Clock, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  ConfidentialityTier,
  DocumentCopyFormat,
  SlaState,
} from '../domain/types';

export const SlaBadge: React.FC<{ state: SlaState; suffix?: string }> = ({ state, suffix }) => {
  if (state === 'on_track') {
    if (!suffix) return null;
    return (
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {suffix}
      </span>
    );
  }

  const label =
    state === 'overdue'
      ? `Overdue${suffix ? ` · ${suffix}` : ''}`
      : `Due soon${suffix ? ` · ${suffix}` : ''}`;

  const cls = state === 'overdue' ? 'pill pill-rose' : 'pill pill-amber';

  return (
    <span className={cls}>
      {state === 'overdue' ? <ShieldAlert size={11} /> : <Clock size={11} />}
      <span>{label}</span>
    </span>
  );
};

export const CopyFormatBadge: React.FC<{ format: DocumentCopyFormat }> = ({ format }) => {
  const label =
    format === 'hard_copy' ? 'Hard Copy' : format === 'hybrid' ? 'Hard + Soft' : 'Soft Copy';
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--text-secondary)',
      }}
    >
      {label}
    </span>
  );
};

export const TierBadge: React.FC<{ tier: ConfidentialityTier }> = ({ tier }) => {
  if (tier === 'confidential') {
    return (
      <span className="pill pill-rose">
        <Lock size={11} />
        <span>Confidential</span>
      </span>
    );
  }
  if (tier === 'restricted') {
    return (
      <span className="pill pill-amber">
        <ShieldCheck size={11} />
        <span>Restricted</span>
      </span>
    );
  }
  return null;
};
